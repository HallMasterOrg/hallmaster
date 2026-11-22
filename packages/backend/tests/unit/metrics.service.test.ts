import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BotRepository from "#repositories/bot.repository";
import ClusterSampleRepository from "#repositories/cluster-sample.repository";
import ClusterRepository from "#repositories/cluster.repository";
import DockerService from "#services/docker.service";
import MetricsService from "#services/metrics.service";

vi.mock("#repositories/bot.repository", () => ({
  default: {
    findFirstId: vi.fn(),
  },
}));

vi.mock("#repositories/cluster.repository", () => ({
  default: {
    findManyIdBotIdAndContainerId: vi.fn(),
  },
}));

vi.mock("#repositories/cluster-sample.repository", () => ({
  default: {
    createMany: vi.fn(),
    deleteManyBefore: vi.fn(),
    findManyBuckets: vi.fn(),
  },
}));

vi.mock("#services/docker.service", () => ({
  default: {
    containerStates: vi.fn(),
    streamContainerStats: vi.fn(),
  },
}));

const streams = new Map<string, PassThrough[]>();

function givenClusters(clusters: { id: number; state: string }[]) {
  vi.mocked(ClusterRepository.findManyIdBotIdAndContainerId).mockResolvedValue(
    clusters.map(({ id }) => ({ id, botId: "bot", containerId: `container-${id}` })),
  );
  vi.mocked(DockerService.containerStates).mockResolvedValue(
    new Map(clusters.map(({ id, state }) => [`container-${id}`, state])),
  );
}

function latestStream(containerId: string) {
  const stream = streams.get(containerId)?.at(-1);
  if (stream === undefined) throw new Error(`No stream for ${containerId}`);

  return stream;
}

async function emit(containerId: string, cpuPercentage: number, usage: number) {
  latestStream(containerId).write({
    cpuPercentage,
    memory: { usage, percentage: usage / 10 },
    network: [],
  });
  await new Promise((resolve) => setImmediate(resolve));
}

function recorded() {
  return vi.mocked(ClusterSampleRepository.createMany).mock.calls.flatMap(([samples]) => samples);
}

beforeEach(() => {
  vi.resetAllMocks();
  streams.clear();
  vi.mocked(DockerService.streamContainerStats).mockImplementation((containerId) => {
    const stream = new PassThrough({ objectMode: true });
    streams.set(containerId, [...(streams.get(containerId) ?? []), stream]);

    return Promise.resolve(stream);
  });
});

afterEach(() => {
  MetricsService.stop();
  vi.useRealTimers();
});

describe("collector", () => {
  it("watches the running clusters only", async () => {
    givenClusters([
      { id: 0, state: "running" },
      { id: 1, state: "exited" },
    ]);

    await MetricsService.sync();
    await MetricsService.sync();

    expect(DockerService.streamContainerStats).toHaveBeenCalledTimes(1);
    expect(DockerService.streamContainerStats).toHaveBeenCalledWith("container-0");
  });

  it("stores the average of the readings since the last sample", async () => {
    givenClusters([{ id: 0, state: "running" }]);
    await MetricsService.sync();

    await emit("container-0", 10, 100);
    await emit("container-0", 30, 201);
    const at = new Date("2026-11-15T12:00:00Z");
    await MetricsService.record(at);

    expect(recorded()).toEqual([
      {
        botId: "bot",
        clusterId: 0,
        at,
        cpuPercentage: 20,
        memoryUsage: 151n,
        memoryPercentage: 15.05,
      },
    ]);
  });

  it("stores nothing for a cluster without new readings", async () => {
    givenClusters([{ id: 0, state: "running" }]);
    await MetricsService.sync();

    await emit("container-0", 10, 100);
    await MetricsService.record();
    await MetricsService.record();

    expect(ClusterSampleRepository.createMany).toHaveBeenCalledTimes(1);
  });

  it("closes the stream of a cluster that stopped", async () => {
    givenClusters([{ id: 0, state: "running" }]);
    await MetricsService.sync();
    const stream = latestStream("container-0");

    givenClusters([{ id: 0, state: "exited" }]);
    await MetricsService.sync();

    expect(stream.destroyed).toBe(true);
  });

  it("watches the new container of a redeployed cluster", async () => {
    givenClusters([{ id: 0, state: "running" }]);
    await MetricsService.sync();
    const previous = latestStream("container-0");

    vi.mocked(ClusterRepository.findManyIdBotIdAndContainerId).mockResolvedValue([
      { id: 0, botId: "bot", containerId: "container-0-new" },
    ]);
    vi.mocked(DockerService.containerStates).mockResolvedValue(
      new Map([["container-0-new", "running"]]),
    );
    await MetricsService.sync();

    expect(previous.destroyed).toBe(true);
    expect(DockerService.streamContainerStats).toHaveBeenLastCalledWith("container-0-new");
  });

  it("watches a cluster again once its stream failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    givenClusters([{ id: 0, state: "running" }]);
    await MetricsService.sync();

    const failed = latestStream("container-0");
    failed.destroy(new Error("socket closed"));
    await new Promise((resolve) => failed.once("close", resolve));
    await MetricsService.sync();

    expect(streams.get("container-0")).toHaveLength(2);
    await emit("container-0", 5, 50);
    await MetricsService.record();
    expect(recorded()).toMatchObject([{ clusterId: 0, cpuPercentage: 5 }]);
  });

  it("closes every stream once stopped", async () => {
    givenClusters([{ id: 0, state: "running" }]);
    await MetricsService.sync();

    MetricsService.stop();

    expect(latestStream("container-0").destroyed).toBe(true);
  });

  it("deletes the samples older than the retention", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-15T12:00:00Z") });

    await MetricsService.purge(7);

    expect(ClusterSampleRepository.deleteManyBefore).toHaveBeenCalledWith(
      new Date("2026-11-08T12:00:00Z"),
    );
  });
});

describe("history", () => {
  it.each([
    ["1h", 15],
    ["6h", 90],
    ["24h", 360],
    ["7d", 2520],
  ] as const)("averages the %s history over %i seconds", (range, seconds) => {
    expect(MetricsService.interval(range)).toBe(seconds);
  });

  it("groups the buckets by cluster", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-15T12:00:00Z") });
    vi.mocked(BotRepository.findFirstId).mockResolvedValue({ id: "bot" });
    vi.mocked(ClusterSampleRepository.findManyBuckets).mockResolvedValue([
      {
        clusterId: 0,
        at: new Date("2026-11-15T11:00:00Z"),
        cpuPercentage: 1,
        memoryUsage: 10,
        memoryPercentage: 2,
      },
      {
        clusterId: 0,
        at: new Date("2026-11-15T11:00:15Z"),
        cpuPercentage: 3,
        memoryUsage: 30,
        memoryPercentage: 4,
      },
      {
        clusterId: 1,
        at: new Date("2026-11-15T11:00:00Z"),
        cpuPercentage: 5,
        memoryUsage: 50,
        memoryPercentage: 6,
      },
    ]);

    const history = await MetricsService.history("1h");

    expect(ClusterSampleRepository.findManyBuckets).toHaveBeenCalledWith(
      "bot",
      new Date("2026-11-15T11:00:00Z"),
      15,
    );
    expect(history).toEqual({
      from: "2026-11-15T11:00:00.000Z",
      to: "2026-11-15T12:00:00.000Z",
      interval: 15,
      clusters: {
        0: [
          {
            at: "2026-11-15T11:00:00.000Z",
            cpuPercentage: 1,
            memory: { usage: 10, percentage: 2 },
          },
          {
            at: "2026-11-15T11:00:15.000Z",
            cpuPercentage: 3,
            memory: { usage: 30, percentage: 4 },
          },
        ],
        1: [
          {
            at: "2026-11-15T11:00:00.000Z",
            cpuPercentage: 5,
            memory: { usage: 50, percentage: 6 },
          },
        ],
      },
    });
  });

  it("is empty without a bot", async () => {
    vi.mocked(BotRepository.findFirstId).mockResolvedValue(null);

    expect((await MetricsService.history("24h")).clusters).toEqual({});
    expect(ClusterSampleRepository.findManyBuckets).not.toHaveBeenCalled();
  });
});
