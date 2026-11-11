import { BadRequestException, NotFoundException } from "#exceptions/http-exceptions";
import type { Bot, Cluster as ClusterRow, ContainerImage } from "#prisma/client";
import BotRepository from "#repositories/bot.repository";
import ClusterRepository from "#repositories/cluster.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import type {
  Cluster,
  ClusterAction,
  ClusterId,
  ClusterLogsQuery,
  ClustersBulkActionResult,
  ClusterStatus,
  UpdateClusters,
} from "#schemas/cluster.schema";

import DockerService from "./docker.service";

type PendingStatus = Extract<ClusterStatus, "STARTING" | "UPDATING">;

export default class ClusterService {
  private static readonly pendingStatuses = new Map<ClusterId, PendingStatus>();

  private static async track<T>(
    ids: ClusterId[],
    status: PendingStatus,
    operation: () => Promise<T>,
  ) {
    for (const id of ids) {
      this.pendingStatuses.set(id, status);
    }

    try {
      return await operation();
    } finally {
      for (const id of ids) {
        this.pendingStatuses.delete(id);
      }
    }
  }

  private static status(
    desiredStatus: ClusterRow["desiredStatus"],
    containerState: string | undefined,
    pendingStatus: PendingStatus | undefined,
  ): ClusterStatus {
    if (pendingStatus !== undefined) {
      return pendingStatus;
    }

    switch (containerState) {
      case undefined:
        return "ERROR";
      case "running":
        return "RUNNING";
      case "restarting":
        return "STARTING";
      default:
        return desiredStatus === "RUNNING" ? "ERROR" : "STOPPED";
    }
  }

  private static async findManyObserved() {
    const clusters = await ClusterRepository.findManyWithContainerId();
    const containerStates = await DockerService.containerStates(
      clusters.map(({ containerId }) => containerId),
    );

    return clusters.map(({ id, shardIds, desiredStatus, containerId }) => ({
      id,
      shardIds,
      containerId,
      status: this.status(
        desiredStatus,
        containerStates.get(containerId),
        this.pendingStatuses.get(id),
      ),
    }));
  }

  private static async findObserved(id: ClusterId) {
    const cluster = (await this.findManyObserved()).find((cluster) => cluster.id === id);
    if (cluster === undefined) {
      throw new NotFoundException({ message: `Cluster ${id} not found` });
    }

    return cluster;
  }

  private static async create(
    cluster: Pick<ClusterRow, "id" | "shardIds" | "desiredStatus">,
    bot: Pick<Bot, "id" | "token" | "totalShards">,
    containerImage: Pick<ContainerImage, "serverName" | "image" | "tag">,
  ) {
    const shards = cluster.shardIds.join(",");

    const container = await DockerService.create(
      {
        Image: `${containerImage.serverName}/${containerImage.image}:${containerImage.tag}`,
        Env: [
          `DISCORD_BOT_TOKEN=${bot.token}`,
          `TOTAL_SHARDS=${bot.totalShards}`,
          `SHARD_ID_LIST=${shards}`,
        ],
        Labels: {
          "dev.hallmaster.cluster": cluster.id.toString(),
          "dev.hallmaster.shards": shards,
        },
      },
      `${bot.id}-${cluster.id}`,
    );

    await ClusterRepository.create({
      id: cluster.id,
      botId: bot.id,
      containerId: container.Id,
      shardIds: cluster.shardIds,
      desiredStatus: cluster.desiredStatus,
    });

    return container.Id;
  }

  private static async findRunningContainerId(id: ClusterId) {
    const cluster = await this.findObserved(id);
    if (cluster.status !== "RUNNING") {
      throw new BadRequestException({ message: `Cluster ${id} is not running` });
    }

    return cluster.containerId;
  }

  public static async get(id: ClusterId): Promise<Cluster> {
    const { shardIds, status } = await this.findObserved(id);

    return { id, shardIds, status };
  }

  public static async logs(id: ClusterId, options: ClusterLogsQuery) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    return DockerService.containerLogs(cluster.containerId, {
      tail: options.tail,
      since: options.since && Math.floor(options.since.getTime() / 1000),
      until: options.until && Math.ceil(options.until.getTime() / 1000),
      stdout: true,
      stderr: true,
      timestamps: true,
      follow: false,
    });
  }

  public static async streamLogs(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    return DockerService.streamContainerLogs(cluster.containerId, {
      tail: 0,
      stdout: true,
      stderr: true,
      timestamps: true,
    });
  }

  public static async stats(id: ClusterId) {
    const containerId = await this.findRunningContainerId(id);

    return DockerService.containerStats(containerId);
  }

  public static async getAllStats() {
    const clusters = (await this.findManyObserved()).filter(({ status }) => status === "RUNNING");
    const results = await Promise.allSettled(
      clusters.map(
        async ({ id, containerId }) =>
          [id, await DockerService.containerStats(containerId)] as const,
      ),
    );

    return Object.fromEntries(
      results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
    );
  }

  public static async streamStats(id: ClusterId) {
    const containerId = await this.findRunningContainerId(id);

    return DockerService.streamContainerStats(containerId);
  }

  public static async start(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    await this.track([id], "STARTING", async () => {
      await ClusterRepository.updateDesiredStatusById("RUNNING", id);
      await DockerService.startContainer(cluster.containerId);
    });

    return this.get(id);
  }

  public static async stop(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    await ClusterRepository.updateDesiredStatusById("STOPPED", id);
    await DockerService.stopContainer(cluster.containerId);

    return this.get(id);
  }

  public static async restart(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    await this.track([id], "STARTING", async () => {
      await ClusterRepository.updateDesiredStatusById("RUNNING", id);
      await DockerService.restartContainer(cluster.containerId);
    });

    return this.get(id);
  }

  public static async runAction(id: ClusterId, action: ClusterAction) {
    const actions = {
      start: () => this.start(id),
      stop: () => this.stop(id),
      restart: () => this.restart(id),
    } satisfies Record<ClusterAction, () => Promise<Cluster>>;

    return actions[action]();
  }

  public static async runActionOnAll(action: ClusterAction): Promise<ClustersBulkActionResult> {
    const clusters = await ClusterRepository.findManyId();
    const outcomes = await Promise.all(
      clusters.map(({ id }) =>
        this.runAction(id, action).then(
          () => ({ id, reason: null }),
          (error: unknown) => ({
            id,
            reason: error instanceof Error ? error.message : String(error),
          }),
        ),
      ),
    );

    return {
      succeeded: outcomes.filter(({ reason }) => reason === null).map(({ id }) => id),
      failed: outcomes.flatMap(({ id, reason }) => (reason === null ? [] : [{ id, reason }])),
    };
  }

  public static async remove(id: ClusterId): Promise<Cluster> {
    const { shardIds, status, containerId } = await this.findObserved(id);

    await DockerService.stopContainer(containerId);
    await DockerService.removeContainer(containerId);
    await ClusterRepository.deleteById(id);

    return { id, shardIds, status };
  }

  public static async getAll(): Promise<Cluster[]> {
    const clusters = await this.findManyObserved();

    return clusters.map(({ id, shardIds, status }) => ({ id, shardIds, status }));
  }

  public static async stopAll() {
    const clusters = await ClusterRepository.findManyIdAndContainerId();
    if (clusters.length === 0) {
      return;
    }

    await Promise.all(clusters.map(({ containerId }) => DockerService.stopContainer(containerId)));

    return ClusterRepository.updateManyDesiredStatusById(
      "STOPPED",
      clusters.map(({ id }) => id),
    );
  }

  public static async removeAll() {
    const clusters = await ClusterRepository.findManyIdAndContainerId();
    if (clusters.length === 0) return;

    await Promise.all(
      clusters.map(({ containerId }) => DockerService.removeContainer(containerId)),
    );

    return ClusterRepository.deleteManyById(clusters.map(({ id }) => id));
  }

  public static async updateAll(clusters: UpdateClusters) {
    const bot = await BotRepository.findFirstIdAndToken();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    const ids = new Set<UpdateClusters[number]["id"]>();
    const previous = await ClusterRepository.findMany();
    const previousIds = new Set(previous.map(({ id }) => id));

    for (const [index, cluster] of clusters.entries()) {
      if (cluster.shardIds.length === 0)
        throw new BadRequestException({ message: `Cluster at index ${index} is empty` });

      if (cluster.id === undefined) continue;

      if (ids.has(cluster.id))
        throw new BadRequestException({ message: `Duplicate cluster ${cluster.id}` });

      if (!previousIds.has(cluster.id))
        throw new BadRequestException({ message: `Cluster ${cluster.id} does not exist` });

      ids.add(cluster.id);
    }

    const shards = clusters.flatMap(({ shardIds }) => shardIds).sort((a, b) => a - b);
    for (let index = 0; index < shards.length; index++) {
      const shard = shards[index];

      if (shard !== index) {
        throw new BadRequestException({
          message: `Non-contiguous shard IDs, expected ${index} but got ${shard}`,
        });
      }
    }

    let nextId = 0;
    for (const cluster of clusters) {
      if (cluster.id !== undefined) continue;

      while (ids.has(nextId)) nextId++;
      cluster.id = nextId++;
    }

    const containerImage = await ContainerImageRepository.findFirst();
    if (containerImage === null)
      throw new NotFoundException({ message: "Container image not found" });

    await DockerService.ensureImage(containerImage);

    const affectedIds = [...new Set([...previousIds, ...clusters.map(({ id }) => id!)])];
    await this.track(affectedIds, "UPDATING", async () => {
      await this.stopAll();
      await this.removeAll();

      const updatedBot = await BotRepository.updateTotalShards({ totalShards: shards.length });
      if (updatedBot === null) {
        throw new NotFoundException({ message: "Bot not found" });
      }

      const desiredStatuses = new Map(previous.map(({ id, desiredStatus }) => [id, desiredStatus]));
      await Promise.all(
        clusters.map(async (cluster) => {
          const desiredStatus = desiredStatuses.get(cluster.id!) ?? "RUNNING";
          const containerId = await this.create(
            { id: cluster.id!, shardIds: cluster.shardIds, desiredStatus },
            { ...bot, totalShards: updatedBot.totalShards },
            containerImage,
          );

          if (desiredStatus === "RUNNING") {
            await DockerService.startContainer(containerId);
          }
        }),
      );
    });

    return this.getAll();
  }
}
