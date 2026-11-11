import { beforeEach, describe, expect, it, vi } from "vitest";

import BotRepository from "#repositories/bot.repository";
import ClusterRepository from "#repositories/cluster.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import ClusterService from "#services/cluster.service";
import DockerService from "#services/docker.service";

vi.mock("#repositories/bot.repository", () => ({
  default: {
    findFirstIdAndToken: vi.fn(),
    updateTotalShards: vi.fn(),
  },
}));

vi.mock("#repositories/cluster.repository", () => ({
  default: {
    create: vi.fn(),
    deleteManyById: vi.fn(),
    findFirstContainerIdById: vi.fn(),
    findMany: vi.fn(),
    findManyId: vi.fn(),
    findManyIdAndContainerId: vi.fn(),
    findManyWithContainerId: vi.fn(),
    updateDesiredStatusById: vi.fn(),
    updateManyDesiredStatusById: vi.fn(),
  },
}));

vi.mock("#repositories/container-image.repository", () => ({
  default: {
    findFirst: vi.fn(),
  },
}));

vi.mock("#services/docker.service", () => ({
  default: {
    containerLogs: vi.fn(),
    containerStates: vi.fn(),
    create: vi.fn(),
    ensureImage: vi.fn(),
    removeContainer: vi.fn(),
    startContainer: vi.fn(),
    stopContainer: vi.fn(),
  },
}));

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
}

beforeEach(() => {
  vi.resetAllMocks();
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
    vi.mocked(BotRepository.findFirstIdAndToken).mockResolvedValue({ id: "bot", token: "token" });
    vi.mocked(BotRepository.updateTotalShards).mockImplementation(({ totalShards }) =>
      Promise.resolve({ id: "bot", totalShards }),
    );
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue({
      serverName: "docker.io",
      image: "library/alpine",
      tag: "latest",
      username: null,
      password: null,
    });
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

  it("leaves the current clusters untouched when the image is unavailable", async () => {
    vi.mocked(DockerService.ensureImage).mockRejectedValue(new Error("pull access denied"));

    await expect(ClusterService.updateAll([{ shardIds: [0] }])).rejects.toThrow(
      "pull access denied",
    );
    expect(DockerService.stopContainer).not.toHaveBeenCalled();
    expect(DockerService.removeContainer).not.toHaveBeenCalled();
  });
});
