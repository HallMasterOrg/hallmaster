import type { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";

import type { Cluster } from "#prisma/client";
import BotRepository from "#repositories/bot.repository";
import ClusterSampleRepository, {
  type ClusterSampleBucket,
} from "#repositories/cluster-sample.repository";
import ClusterRepository from "#repositories/cluster.repository";
import type {
  ClusterStats,
  ClusterStatsHistoryRange,
  ClusterStatsPoint,
  ClustersStatsHistory,
} from "#schemas/cluster.schema";

import DockerService from "./docker.service";

type Reading = Pick<ClusterStats, "cpuPercentage" | "memory">;

type WatchableCluster = Pick<Cluster, "id" | "botId" | "containerId">;

type WatchedCluster = {
  botId: Cluster["botId"];
  clusterId: Cluster["id"];
  stream: Readable;
  readings: Reading[];
};

type MetricsOptions = {
  intervalSeconds: number;
  retentionDays: number;
};

const RANGE_SECONDS = {
  "1h": 3_600,
  "6h": 21_600,
  "24h": 86_400,
  "7d": 604_800,
} satisfies Record<ClusterStatsHistoryRange, number>;

const HISTORY_POINTS = 240;
const PURGE_INTERVAL_SECONDS = 3_600;
const DAY_MILLISECONDS = 86_400_000;

export default class MetricsService {
  private static readonly watched = new Map<string, WatchedCluster>();
  private static controller = new AbortController();

  private static async repeat(seconds: number, task: () => Promise<unknown>) {
    const { signal } = this.controller;

    while (!signal.aborted) {
      await task().catch((error: unknown) => console.error(error));
      await sleep(seconds * 1000, undefined, { signal }).catch(() => undefined);
    }
  }

  private static average(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private static async watch({ id, botId, containerId }: WatchableCluster) {
    const { signal } = this.controller;
    const stream = await DockerService.streamContainerStats(containerId);
    if (signal.aborted || this.watched.has(containerId)) {
      stream.destroy();
      return;
    }

    const cluster: WatchedCluster = { botId, clusterId: id, stream, readings: [] };
    this.watched.set(containerId, cluster);

    stream.on("data", ({ cpuPercentage, memory }: ClusterStats) => {
      cluster.readings.push({ cpuPercentage, memory });
    });
    stream.on("error", (error) => console.error(error));
    stream.on("close", () => {
      if (this.watched.get(containerId) === cluster) {
        this.watched.delete(containerId);
      }
    });
  }

  public static start({ intervalSeconds, retentionDays }: MetricsOptions) {
    this.stop();

    void this.repeat(intervalSeconds, async () => {
      await this.record();
      await this.sync();
    });
    void this.repeat(PURGE_INTERVAL_SECONDS, () => this.purge(retentionDays));
  }

  public static stop() {
    this.controller.abort();
    this.controller = new AbortController();

    for (const { stream } of this.watched.values()) {
      stream.destroy();
    }
    this.watched.clear();
  }

  public static async sync() {
    const clusters = await ClusterRepository.findManyIdBotIdAndContainerId();
    const states = await DockerService.containerStates(
      clusters.map(({ containerId }) => containerId),
    );
    const running = clusters.filter(({ containerId }) => states.get(containerId) === "running");

    for (const [containerId, { stream }] of this.watched) {
      if (!running.some((cluster) => cluster.containerId === containerId)) {
        stream.destroy();
      }
    }

    await Promise.all(
      running
        .filter(({ containerId }) => !this.watched.has(containerId))
        .map((cluster) => this.watch(cluster)),
    );
  }

  public static async record(at = new Date()) {
    const samples = [...this.watched.values()].flatMap((cluster) => {
      const { botId, clusterId, readings } = cluster;
      if (readings.length === 0) return [];

      cluster.readings = [];

      return [
        {
          botId,
          clusterId,
          at,
          cpuPercentage: this.average(readings.map(({ cpuPercentage }) => cpuPercentage)),
          memoryUsage: BigInt(Math.round(this.average(readings.map(({ memory }) => memory.usage)))),
          memoryPercentage: this.average(readings.map(({ memory }) => memory.percentage)),
        },
      ];
    });

    if (samples.length > 0) {
      await ClusterSampleRepository.createMany(samples);
    }
  }

  public static async purge(retentionDays: number) {
    await ClusterSampleRepository.deleteManyBefore(
      new Date(Date.now() - retentionDays * DAY_MILLISECONDS),
    );
  }

  public static interval(range: ClusterStatsHistoryRange) {
    return Math.ceil(RANGE_SECONDS[range] / HISTORY_POINTS);
  }

  public static series(buckets: ClusterSampleBucket[]) {
    const series: Record<number, ClusterStatsPoint[]> = {};

    for (const { clusterId, at, cpuPercentage, memoryUsage, memoryPercentage } of buckets) {
      series[clusterId] ??= [];
      series[clusterId].push({
        at: at.toISOString(),
        cpuPercentage,
        memory: { usage: memoryUsage, percentage: memoryPercentage },
      });
    }

    return series;
  }

  public static async history(range: ClusterStatsHistoryRange): Promise<ClustersStatsHistory> {
    const to = new Date();
    const from = new Date(to.getTime() - RANGE_SECONDS[range] * 1000);
    const interval = this.interval(range);

    const bot = await BotRepository.findFirstId();
    const buckets =
      bot === null ? [] : await ClusterSampleRepository.findManyBuckets(bot.id, from, interval);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      interval,
      clusters: this.series(buckets),
    };
  }
}
