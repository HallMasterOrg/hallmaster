import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BotRepository from "#repositories/bot.repository";
import ClusterRepository from "#repositories/cluster.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import EnvironmentVariableRepository from "#repositories/environment-variable.repository";
import AlertService from "#services/alert.service";
import ClusterOperationService from "#services/cluster-operation.service";
import ClusterService from "#services/cluster.service";
import DockerService from "#services/docker.service";

vi.mock("#lib/env", () => ({
  default: { CLUSTER_READY_DELAY_SECONDS: 10, CLUSTER_READY_TIMEOUT_SECONDS: 300 },
}));

vi.mock("#services/alert.service", () => ({
  default: {
    deployed: vi.fn(),
    deploymentFailed: vi.fn(),
  },
}));

vi.mock("#repositories/bot.repository", () => ({
  default: {
    findFirstId: vi.fn(),
    findFirstIdAndToken: vi.fn(),
    findFirstIdContainerImageTotalShardsAndToken: vi.fn(),
    findFirstIdTokenAndTotalShards: vi.fn(),
    updateTotalShards: vi.fn(),
  },
}));

vi.mock("#repositories/cluster.repository", () => ({
  default: {
    create: vi.fn(),
    deleteManyById: vi.fn(),
    findFirstContainerIdById: vi.fn(),
    findFirstWithContainerIdById: vi.fn(),
    findMany: vi.fn(),
    findManyId: vi.fn(),
    findManyIdAndContainerId: vi.fn(),
    findManyWithContainerId: vi.fn(),
    updateContainerIdById: vi.fn(),
    updateDesiredStatusById: vi.fn(),
    updateManyDesiredStatusById: vi.fn(),
  },
}));

vi.mock("#repositories/container-image.repository", () => ({
  default: {
    findFirst: vi.fn(),
  },
}));

vi.mock("#repositories/environment-variable.repository", () => ({
  default: {
    findMany: vi.fn(),
  },
}));

vi.mock("#services/docker.service", () => ({
  default: {
    containerLogs: vi.fn(),
    containerStates: vi.fn(),
    containerStats: vi.fn(),
    create: vi.fn(),
    ensureImage: vi.fn(),
    findContainerId: vi.fn(),
    removeContainer: vi.fn(),
    renameContainer: vi.fn(),
    restartContainer: vi.fn(),
    startContainer: vi.fn(),
    stopContainer: vi.fn(),
    streamContainerLogs: vi.fn(),
    waitUntilReady: vi.fn(),
  },
}));

const containerImage = {
  serverName: "docker.io",
  image: "library/alpine",
  tag: "latest",
  username: null,
  password: null,
};

type ObservedCluster = {
  id: number;
  desiredStatus: "RUNNING" | "STOPPED";
  containerState?: string;
};

function givenClusters(clusters: ObservedCluster[]) {
  vi.mocked(ClusterRepository.findManyWithContainerId).mockResolvedValue(
    clusters.map(({ id, desiredStatus }) => ({
      id,
      shardIds: [id],
      desiredStatus,
      containerId: `container-${id}`,
    })),
  );
  vi.mocked(DockerService.containerStates).mockResolvedValue(
    new Map(
      clusters.flatMap(({ id, containerState }) =>
        containerState === undefined ? [] : [[`container-${id}`, containerState] as const],
      ),
    ),
  );
  vi.mocked(ClusterRepository.findFirstContainerIdById).mockImplementation((id) =>
    Promise.resolve(
      clusters.some((cluster) => cluster.id === id) ? { containerId: `container-${id}` } : null,
    ),
  );
  vi.mocked(ClusterRepository.findFirstWithContainerIdById).mockImplementation((id) => {
    const cluster = clusters.find((cluster) => cluster.id === id);

    return Promise.resolve(
      cluster === undefined
        ? null
        : {
            id,
            shardIds: [id],
            desiredStatus: cluster.desiredStatus,
            containerId: `container-${id}`,
          },
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(AlertService.deployed).mockResolvedValue(undefined);
  vi.mocked(AlertService.deploymentFailed).mockResolvedValue(undefined);
});

afterEach(async () => {
  await ClusterOperationService.idle();
});

describe("cluster status", () => {
  it.each([
    ["RUNNING", "running", "RUNNING"],
    ["STOPPED", "running", "RUNNING"],
    ["RUNNING", "restarting", "STARTING"],
    ["RUNNING", "exited", "ERROR"],
    ["STOPPED", "exited", "STOPPED"],
    ["STOPPED", "created", "STOPPED"],
    ["RUNNING", undefined, "ERROR"],
    ["STOPPED", undefined, "ERROR"],
  ] as const)(
    "reports a cluster desired %s with a %s container as %s",
    async (desiredStatus, containerState, expected) => {
      givenClusters([{ id: 0, desiredStatus, containerState }]);

      const [cluster] = await ClusterService.getAll();

      expect(cluster.status).toBe(expected);
    },
  );

  it("reports STARTING while a start is in progress", async () => {
    givenClusters([{ id: 0, desiredStatus: "STOPPED", containerState: "exited" }]);
    let finishStart = () => {};
    vi.mocked(DockerService.startContainer).mockReturnValue(
      new Promise((resolve) => {
        finishStart = () => resolve(undefined);
      }),
    );

    const start = ClusterService.start(0);
    await vi.waitFor(() => expect(DockerService.startContainer).toHaveBeenCalled());

    expect((await ClusterService.get(0)).status).toBe("STARTING");

    givenClusters([{ id: 0, desiredStatus: "RUNNING", containerState: "running" }]);
    finishStart();

    expect((await start).status).toBe("RUNNING");
    expect(ClusterRepository.updateDesiredStatusById).toHaveBeenCalledWith("RUNNING", 0);
  });

  it("rejects stats of a cluster that is not running", async () => {
    givenClusters([{ id: 0, desiredStatus: "RUNNING", containerState: "exited" }]);

    await expect(ClusterService.stats(0)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an unknown cluster", async () => {
    givenClusters([]);

    await expect(ClusterService.get(42)).rejects.toMatchObject({ status: 404 });
  });
});

describe("cluster actions on every cluster", () => {
  it("reports which clusters succeeded and which failed", async () => {
    givenClusters([
      { id: 0, desiredStatus: "RUNNING", containerState: "running" },
      { id: 1, desiredStatus: "RUNNING", containerState: "running" },
    ]);
    vi.mocked(ClusterRepository.findManyId).mockResolvedValue([{ id: 0 }, { id: 1 }]);
    vi.mocked(DockerService.startContainer).mockImplementation((containerId) =>
      containerId === "container-1"
        ? Promise.reject(new Error("No such container"))
        : Promise.resolve(),
    );

    const result = await ClusterService.runActionOnAll("start");

    expect(result).toEqual({
      succeeded: [0],
      failed: [{ id: 1, reason: "No such container" }],
    });
  });

  it("keeps the reason of a failure that is not an Error", async () => {
    givenClusters([{ id: 0, desiredStatus: "RUNNING", containerState: "running" }]);
    vi.mocked(ClusterRepository.findManyId).mockResolvedValue([{ id: 0 }]);
    vi.mocked(DockerService.restartContainer).mockRejectedValue("socket closed");

    const result = await ClusterService.runActionOnAll("restart");

    expect(result).toEqual({ succeeded: [], failed: [{ id: 0, reason: "socket closed" }] });
  });
});

describe("cluster whose container was removed", () => {
  beforeEach(() => {
    givenClusters([{ id: 0, desiredStatus: "RUNNING" }]);
    vi.mocked(BotRepository.findFirstIdContainerImageTotalShardsAndToken).mockResolvedValue({
      id: "bot",
      token: "token",
      totalShards: 2,
      containerImage: {
        serverName: "docker.io",
        image: "library/alpine",
        tag: "latest",
        username: null,
        password: null,
      },
    });
    vi.mocked(EnvironmentVariableRepository.findMany).mockResolvedValue([
      { key: "LOG_LEVEL", value: "info" },
    ]);
    vi.mocked(DockerService.create).mockResolvedValue({ Id: "new-0", Warnings: [] });
  });

  it("recreates the container before starting it", async () => {
    await ClusterService.start(0);

    expect(DockerService.ensureImage).toHaveBeenCalledWith(
      expect.objectContaining({ image: "library/alpine" }),
    );
    expect(DockerService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        Image: "docker.io/library/alpine:latest",
        Env: ["LOG_LEVEL=info", "DISCORD_BOT_TOKEN=token", "TOTAL_SHARDS=2", "SHARD_ID_LIST=0"],
      }),
      "bot-0",
    );
    expect(ClusterRepository.updateContainerIdById).toHaveBeenCalledWith("new-0", 0);
    expect(DockerService.startContainer).toHaveBeenCalledWith("new-0");
  });

  it("recreates the container before restarting it", async () => {
    await ClusterService.restart(0);

    expect(DockerService.restartContainer).toHaveBeenCalledWith("new-0");
  });

  it("starts an existing container without recreating it", async () => {
    givenClusters([{ id: 0, desiredStatus: "RUNNING", containerState: "exited" }]);

    await ClusterService.start(0);

    expect(DockerService.create).not.toHaveBeenCalled();
    expect(DockerService.startContainer).toHaveBeenCalledWith("container-0");
  });

  it("refuses to recreate it without a container image", async () => {
    vi.mocked(BotRepository.findFirstIdContainerImageTotalShardsAndToken).mockResolvedValue({
      id: "bot",
      token: "token",
      totalShards: 2,
      containerImage: null,
    });

    await expect(ClusterService.start(0)).rejects.toMatchObject({
      status: 404,
      message: "Container image not found",
    });
    expect(DockerService.create).not.toHaveBeenCalled();
    expect(ClusterRepository.updateDesiredStatusById).not.toHaveBeenCalled();
  });
});

describe("unknown cluster", () => {
  beforeEach(() => {
    givenClusters([]);
  });

  it.each([
    ["read its logs", () => ClusterService.logs(7, { tail: "all" })],
    ["stream its logs", () => ClusterService.streamLogs(7)],
    ["start it", () => ClusterService.start(7)],
    ["stop it", () => ClusterService.stop(7)],
    ["restart it", () => ClusterService.restart(7)],
  ])("refuses to %s", async (_case, action) => {
    await expect(action()).rejects.toMatchObject({ status: 404, message: "Cluster 7 not found" });
    expect(ClusterRepository.updateDesiredStatusById).not.toHaveBeenCalled();
  });
});

describe("stats of every cluster", () => {
  it("leaves out stopped clusters and the ones whose stats can't be read", async () => {
    const stats = {
      cpuPercentage: 1,
      memory: { usage: 10, percentage: 1 },
      network: [],
    };
    givenClusters([
      { id: 0, desiredStatus: "RUNNING", containerState: "running" },
      { id: 1, desiredStatus: "RUNNING", containerState: "running" },
      { id: 2, desiredStatus: "STOPPED", containerState: "exited" },
    ]);
    vi.mocked(DockerService.containerStats).mockImplementation((containerId) =>
      containerId === "container-1" ? Promise.reject(new Error("gone")) : Promise.resolve(stats),
    );

    expect(await ClusterService.getAllStats()).toEqual({ 0: stats });
    expect(DockerService.containerStats).toHaveBeenCalledTimes(2);
  });
});

describe("cluster logs", () => {
  it("sends time bounds to docker in seconds", async () => {
    givenClusters([{ id: 0, desiredStatus: "RUNNING", containerState: "running" }]);

    await ClusterService.logs(0, {
      since: new Date("2026-01-01T00:00:00.400Z"),
      until: new Date("2026-01-01T00:01:00.400Z"),
      tail: "all",
    });

    expect(DockerService.containerLogs).toHaveBeenCalledWith(
      "container-0",
      expect.objectContaining({ since: 1767225600, until: 1767225661 }),
    );
  });
});

describe("cluster layout update", () => {
  beforeEach(() => {
    vi.mocked(BotRepository.findFirstIdTokenAndTotalShards).mockResolvedValue({
      id: "bot",
      token: "token",
      totalShards: 2,
    });
    vi.mocked(BotRepository.updateTotalShards).mockImplementation(({ totalShards }) =>
      Promise.resolve({ id: "bot", totalShards }),
    );
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue(containerImage);
    vi.mocked(EnvironmentVariableRepository.findMany).mockResolvedValue([]);
    vi.mocked(DockerService.create).mockImplementation((_body, name) =>
      Promise.resolve({ Id: `container-${name}`, Warnings: [] }),
    );
    vi.mocked(ClusterRepository.findMany).mockResolvedValue([
      { id: 0, shardIds: [0], desiredStatus: "STOPPED" },
      { id: 1, shardIds: [1], desiredStatus: "RUNNING" },
    ]);
    vi.mocked(ClusterRepository.findManyIdAndContainerId).mockResolvedValue([
      { id: 0, containerId: "old-0" },
      { id: 1, containerId: "old-1" },
    ]);
    givenClusters([]);
  });

  it.each([
    ["an empty cluster", [{ shardIds: [] }]],
    [
      "a duplicated cluster",
      [
        { id: 0, shardIds: [0] },
        { id: 0, shardIds: [1] },
      ],
    ],
    ["an unknown cluster", [{ id: 7, shardIds: [0] }]],
    ["non-contiguous shards", [{ shardIds: [0] }, { shardIds: [2] }]],
  ])("rejects %s", async (_case, layout) => {
    await expect(ClusterService.updateAll(layout)).rejects.toMatchObject({ status: 400 });
    expect(DockerService.stopContainer).not.toHaveBeenCalled();
  });

  it("keeps stopped clusters stopped and starts the others", async () => {
    await ClusterService.updateAll([{ id: 0, shardIds: [0] }, { shardIds: [1, 2] }]);
    await ClusterOperationService.idle();

    expect(ClusterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 0, desiredStatus: "STOPPED", shardIds: [0] }),
    );
    expect(ClusterRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, desiredStatus: "RUNNING", shardIds: [1, 2] }),
    );
    expect(DockerService.startContainer).toHaveBeenCalledTimes(1);
    expect(DockerService.startContainer).toHaveBeenCalledWith("container-bot-1");
  });

  it("stores the total number of shards", async () => {
    await ClusterService.updateAll([{ shardIds: [0, 1] }, { shardIds: [2] }]);

    expect(BotRepository.updateTotalShards).toHaveBeenCalledWith({ totalShards: 3 });
    expect(DockerService.create).toHaveBeenCalledWith(
      expect.objectContaining({ Env: expect.arrayContaining(["TOTAL_SHARDS=3"]) }),
      "bot-0",
    );
  });

  it("adds the environment variables without overriding HallMaster's", async () => {
    vi.mocked(EnvironmentVariableRepository.findMany).mockResolvedValue([
      { key: "DATABASE_URL", value: "postgres://bot" },
      { key: "GREETING", value: "a=b c" },
    ]);

    await ClusterService.updateAll([{ shardIds: [0] }, { shardIds: [1] }]);

    for (const name of ["bot-0", "bot-1"]) {
      expect(DockerService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: [
            "DATABASE_URL=postgres://bot",
            "GREETING=a=b c",
            "DISCORD_BOT_TOKEN=token",
            "TOTAL_SHARDS=2",
            expect.stringMatching(/^SHARD_ID_LIST=/),
          ],
        }),
        name,
      );
    }
  });

  it("refuses a layout when no bot is registered", async () => {
    vi.mocked(BotRepository.findFirstIdTokenAndTotalShards).mockResolvedValue(null);

    await expect(ClusterService.updateAll([{ shardIds: [0] }])).rejects.toMatchObject({
      status: 404,
      message: "Bot not found",
    });
    expect(DockerService.stopContainer).not.toHaveBeenCalled();
  });

  it("refuses a layout when no container image is registered", async () => {
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue(null);

    await expect(ClusterService.updateAll([{ shardIds: [0] }])).rejects.toMatchObject({
      status: 404,
      message: "Container image not found",
    });
    expect(DockerService.stopContainer).not.toHaveBeenCalled();
  });

  it("stops before creating clusters when the bot disappears", async () => {
    vi.mocked(BotRepository.updateTotalShards).mockResolvedValue(null);

    await expect(ClusterService.updateAll([{ shardIds: [0] }])).rejects.toMatchObject({
      status: 404,
    });
    expect(DockerService.create).not.toHaveBeenCalled();
  });

  it("leaves the current clusters untouched when the image is unavailable", async () => {
    vi.mocked(DockerService.ensureImage).mockRejectedValue(new Error("pull access denied"));

    await expect(ClusterService.updateAll([{ shardIds: [0] }])).rejects.toThrow(
      "pull access denied",
    );
    expect(DockerService.stopContainer).not.toHaveBeenCalled();
    expect(DockerService.removeContainer).not.toHaveBeenCalled();
  });

  it("starts the clusters one by one, each once the previous one is ready", async () => {
    vi.mocked(ClusterRepository.findMany).mockResolvedValue([]);
    await ClusterService.updateAll([{ shardIds: [0] }, { shardIds: [1] }, { shardIds: [2] }]);
    await ClusterOperationService.idle();

    const calls = [
      ...vi
        .mocked(DockerService.startContainer)
        .mock.invocationCallOrder.map((order, index) => [
          order,
          `start ${vi.mocked(DockerService.startContainer).mock.calls[index][0]}`,
        ]),
      ...vi
        .mocked(DockerService.waitUntilReady)
        .mock.invocationCallOrder.map((order, index) => [
          order,
          `ready ${vi.mocked(DockerService.waitUntilReady).mock.calls[index][0]}`,
        ]),
    ].sort(([a], [b]) => Number(a) - Number(b));

    expect(calls.map(([, call]) => call)).toEqual([
      "start container-bot-0",
      "ready container-bot-0",
      "start container-bot-1",
      "ready container-bot-1",
      "start container-bot-2",
      "ready container-bot-2",
    ]);
    expect(DockerService.waitUntilReady).toHaveBeenCalledWith("container-bot-0", {
      delayMs: 10_000,
      timeoutMs: 300_000,
    });
  });

  it("reports the cluster being started and the ones waiting for their turn", async () => {
    vi.mocked(ClusterRepository.findMany).mockResolvedValue([]);
    let ready = () => {};
    vi.mocked(DockerService.waitUntilReady).mockReturnValueOnce(
      new Promise((resolve) => (ready = () => resolve(undefined))),
    );
    vi.mocked(DockerService.containerStates).mockResolvedValue(new Map());
    vi.mocked(ClusterRepository.findManyWithContainerId).mockResolvedValue([
      { id: 0, shardIds: [0], desiredStatus: "RUNNING", containerId: "container-bot-0" },
      { id: 1, shardIds: [1], desiredStatus: "RUNNING", containerId: "container-bot-1" },
    ]);

    const clusters = await ClusterService.updateAll([{ shardIds: [0] }, { shardIds: [1] }]);
    ready();

    expect(clusters.map(({ status }) => status)).toEqual(["STARTING", "WAITING"]);
  });

  it("raises an alert for a cluster that is not ready and goes on with the next one", async () => {
    vi.mocked(ClusterRepository.findMany).mockResolvedValue([]);
    vi.mocked(DockerService.waitUntilReady).mockRejectedValueOnce(
      new Error("the container exited with code 1"),
    );

    await ClusterService.updateAll([{ shardIds: [0] }, { shardIds: [1] }]);
    await ClusterOperationService.idle();

    expect(AlertService.deploymentFailed).toHaveBeenCalledWith(
      0,
      "Did not start: the container exited with code 1",
    );
    expect(DockerService.startContainer).toHaveBeenCalledWith("container-bot-1");
    expect(AlertService.deployed).toHaveBeenCalledWith([1]);
  });

  it("refuses a layout while the clusters are being started", async () => {
    vi.mocked(ClusterRepository.findMany).mockResolvedValue([]);
    let ready = () => {};
    vi.mocked(DockerService.waitUntilReady).mockReturnValueOnce(
      new Promise((resolve) => (ready = () => resolve(undefined))),
    );

    await ClusterService.updateAll([{ shardIds: [0] }]);
    givenClusters([{ id: 0, desiredStatus: "RUNNING" }]);

    await expect(ClusterService.updateAll([{ shardIds: [0] }])).rejects.toMatchObject({
      status: 409,
    });
    await expect(ClusterService.stop(0)).rejects.toMatchObject({
      status: 409,
      message: "The clusters are being updated, retry once it is done",
    });
    ready();
  });

  it("refuses a layout while an action runs on a cluster", async () => {
    let finish = () => {};
    const action = ClusterOperationService.run(
      [1],
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    await expect(ClusterService.updateAll([{ shardIds: [0] }])).rejects.toMatchObject({
      status: 409,
      message: "Another operation is running on the clusters, retry once it is done",
    });
    finish();
    await action;
    expect(DockerService.stopContainer).not.toHaveBeenCalled();
  });
});

describe("cluster redeploy", () => {
  let containers: Map<string, string>;

  function clusters(...desiredStatuses: ("RUNNING" | "STOPPED")[]) {
    return desiredStatuses.map((desiredStatus, id) => ({
      id,
      shardIds: [id],
      desiredStatus,
      containerId: `old-${id}`,
    }));
  }

  beforeEach(() => {
    containers = new Map([
      ["bot-0", "old-0"],
      ["bot-1", "old-1"],
      ["bot-2", "old-2"],
    ]);
    vi.mocked(BotRepository.findFirstIdTokenAndTotalShards).mockResolvedValue({
      id: "bot",
      token: "token",
      totalShards: 3,
    });
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue(containerImage);
    vi.mocked(EnvironmentVariableRepository.findMany).mockResolvedValue([]);
    vi.mocked(ClusterRepository.findManyWithContainerId).mockResolvedValue(
      clusters("RUNNING", "STOPPED", "RUNNING"),
    );
    vi.mocked(DockerService.containerStates).mockResolvedValue(new Map());
    vi.mocked(DockerService.findContainerId).mockImplementation((nameOrId) =>
      Promise.resolve(
        containers.get(nameOrId) ??
          ([...containers.values()].includes(nameOrId) ? nameOrId : undefined),
      ),
    );
    vi.mocked(DockerService.renameContainer).mockImplementation((id, name) => {
      for (const [current, containerId] of containers) {
        if (containerId === id) containers.delete(current);
      }
      containers.set(name, id);
      return Promise.resolve();
    });
    vi.mocked(DockerService.create).mockImplementation((_body, name) => {
      containers.set(name!, `new-${name}`);
      return Promise.resolve({ Id: `new-${name}`, Warnings: [] });
    });
    vi.mocked(DockerService.removeContainer).mockImplementation((id) => {
      for (const [name, containerId] of containers) {
        if (containerId === id) containers.delete(name);
      }
      return Promise.resolve(undefined);
    });
  });

  it("replaces the clusters one by one, then removes the previous containers", async () => {
    const { finished } = await ClusterService.redeploy();

    await expect(finished).resolves.toEqual({ failure: null });
    expect(DockerService.stopContainer).toHaveBeenCalledWith("old-0");
    expect(ClusterRepository.updateContainerIdById).toHaveBeenCalledWith("new-bot-0", 0);
    expect(ClusterRepository.updateContainerIdById).toHaveBeenCalledWith("new-bot-1", 1);
    expect(ClusterRepository.updateContainerIdById).toHaveBeenCalledWith("new-bot-2", 2);
    expect(DockerService.startContainer).toHaveBeenCalledTimes(2);
    expect(DockerService.startContainer).not.toHaveBeenCalledWith("new-bot-1");
    expect(DockerService.waitUntilReady).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(DockerService.waitUntilReady).mock.invocationCallOrder[0] <
        vi.mocked(DockerService.stopContainer).mock.invocationCallOrder[1],
    ).toBe(true);
    expect(Object.fromEntries(containers)).toEqual({
      "bot-0": "new-bot-0",
      "bot-1": "new-bot-1",
      "bot-2": "new-bot-2",
    });
    expect(AlertService.deployed).toHaveBeenCalledWith([0, 1, 2]);
  });

  it("brings every cluster back to its previous container when one is not ready", async () => {
    vi.mocked(DockerService.waitUntilReady)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("the container exited with code 1"));

    const { finished } = await ClusterService.redeploy();

    await expect(finished).resolves.toEqual({
      failure:
        "Cluster 2 could not run docker.io/library/alpine:latest, the container exited with code 1. Every cluster went back to the previous version",
    });
    expect(Object.fromEntries(containers)).toEqual({
      "bot-0": "old-0",
      "bot-1": "old-1",
      "bot-2": "old-2",
    });
    expect(ClusterRepository.updateContainerIdById).toHaveBeenLastCalledWith("old-0", 0);
    expect(DockerService.startContainer).toHaveBeenCalledWith("old-2");
    expect(DockerService.startContainer).toHaveBeenCalledWith("old-0");
    expect(DockerService.startContainer).not.toHaveBeenCalledWith("old-1");
    expect(AlertService.deploymentFailed).toHaveBeenCalledWith(
      2,
      "Could not run docker.io/library/alpine:latest: the container exited with code 1. Every cluster went back to the previous version",
    );
  });

  it("reports the cluster being replaced and the ones waiting for their turn", async () => {
    let ready = () => {};
    vi.mocked(DockerService.waitUntilReady).mockReturnValueOnce(
      new Promise((resolve) => (ready = () => resolve(undefined))),
    );

    const { clusters, finished } = await ClusterService.redeploy();
    const start = ClusterService.start(1);
    ready();

    expect(clusters.map(({ status }) => status)).toEqual(["UPDATING", "WAITING", "WAITING"]);
    await expect(start).rejects.toMatchObject({ status: 409 });
    await finished;
    expect((await ClusterService.getAll()).map(({ status }) => status)).not.toContain("UPDATING");
  });

  it("refuses a redeploy while a cluster is busy", async () => {
    let finish = () => {};
    const stop = ClusterOperationService.run(
      [1],
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    await expect(ClusterService.redeploy()).rejects.toMatchObject({
      status: 409,
      message: "Another operation is running on the clusters, retry once it is done",
    });
    finish();
    await stop;
  });

  it("rolls back the deployment a restart interrupted", async () => {
    vi.mocked(BotRepository.findFirstId).mockResolvedValue({ id: "bot" });
    containers = new Map([
      ["bot-0", "new-bot-0"],
      ["bot-0-previous", "old-0"],
      ["bot-1-previous", "old-1"],
      ["bot-2", "old-2"],
    ]);
    vi.mocked(ClusterRepository.findManyWithContainerId).mockResolvedValue([
      { id: 0, shardIds: [0], desiredStatus: "RUNNING", containerId: "new-bot-0" },
      { id: 1, shardIds: [1], desiredStatus: "RUNNING", containerId: "old-1" },
      { id: 2, shardIds: [2], desiredStatus: "RUNNING", containerId: "old-2" },
    ]);

    await ClusterService.recover();

    expect(Object.fromEntries(containers)).toEqual({
      "bot-0": "old-0",
      "bot-1": "old-1",
      "bot-2": "old-2",
    });
    expect(ClusterRepository.updateContainerIdById).toHaveBeenCalledWith("old-0", 0);
    expect(ClusterRepository.updateContainerIdById).toHaveBeenCalledWith("old-1", 1);
    expect(DockerService.startContainer).toHaveBeenCalledWith("old-0");
    expect(DockerService.startContainer).toHaveBeenCalledWith("old-1");
  });
});
