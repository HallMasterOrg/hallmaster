import { createHash } from "node:crypto";

import { BadRequestException, NotFoundException } from "#exceptions/http-exceptions";
import type { Bot, Cluster as ClusterRow, ContainerImage } from "#prisma/client";
import BotRepository from "#repositories/bot.repository";
import ClusterRepository from "#repositories/cluster.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import EnvironmentVariableRepository from "#repositories/environment-variable.repository";
import type {
  Cluster,
  ClusterAction,
  ClusterId,
  ClusterLogsQuery,
  ClustersBulkActionResult,
  ClusterStatus,
  UpdateClusters,
} from "#schemas/cluster.schema";
import type { EnvironmentVariables } from "#schemas/environment.schema";

import ClusterOperationService from "./cluster-operation.service";
import DockerService from "./docker.service";

type PendingStatus = Extract<ClusterStatus, "STARTING" | "UPDATING">;
type ContainerImageReference = Pick<ContainerImage, "serverName" | "image" | "tag">;

const DEPLOYMENT_LABEL = "dev.hallmaster.deployment";

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
      return await ClusterOperationService.run(ids, operation);
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

  private static imageReference({ serverName, image, tag }: ContainerImageReference) {
    return `${serverName}/${image}:${tag}`;
  }

  private static deployment(
    token: Bot["token"],
    containerImage: ContainerImageReference,
    environment: EnvironmentVariables,
  ) {
    return createHash("sha256")
      .update(JSON.stringify([token, this.imageReference(containerImage), environment]))
      .digest("hex");
  }

  private static async createContainer(
    cluster: Pick<ClusterRow, "id" | "shardIds">,
    bot: Pick<Bot, "id" | "token" | "totalShards">,
    containerImage: ContainerImageReference,
    environment: EnvironmentVariables,
  ) {
    const shards = cluster.shardIds.join(",");

    const container = await DockerService.create(
      {
        Image: this.imageReference(containerImage),
        Env: [
          ...environment.map(({ key, value }) => `${key}=${value}`),
          `DISCORD_BOT_TOKEN=${bot.token}`,
          `TOTAL_SHARDS=${bot.totalShards}`,
          `SHARD_ID_LIST=${shards}`,
        ],
        Labels: {
          "dev.hallmaster.cluster": cluster.id.toString(),
          "dev.hallmaster.shards": shards,
          [DEPLOYMENT_LABEL]: this.deployment(bot.token, containerImage, environment),
        },
      },
      `${bot.id}-${cluster.id}`,
    );

    return container.Id;
  }

  private static async create(
    cluster: Pick<ClusterRow, "id" | "shardIds" | "desiredStatus">,
    bot: Pick<Bot, "id" | "token" | "totalShards">,
    containerImage: ContainerImageReference,
    environment: EnvironmentVariables,
  ) {
    const containerId = await this.createContainer(cluster, bot, containerImage, environment);

    await ClusterRepository.create({
      id: cluster.id,
      botId: bot.id,
      containerId,
      shardIds: cluster.shardIds,
      desiredStatus: cluster.desiredStatus,
    });

    return containerId;
  }

  private static async findWithContainerId(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstWithContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    return cluster;
  }

  private static async ensureContainer(
    cluster: Pick<ClusterRow, "id" | "shardIds" | "containerId">,
  ) {
    const states = await DockerService.containerStates([cluster.containerId]);
    if (states.has(cluster.containerId)) return cluster.containerId;

    const bot = await BotRepository.findFirstIdContainerImageTotalShardsAndToken();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });
    if (bot.containerImage === null)
      throw new NotFoundException({ message: "Container image not found" });

    await DockerService.ensureImage(bot.containerImage);
    const environment = await EnvironmentVariableRepository.findMany();
    const containerId = await this.createContainer(cluster, bot, bot.containerImage, environment);
    await ClusterRepository.updateContainerIdById(containerId, cluster.id);

    return containerId;
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
    const cluster = await this.findWithContainerId(id);

    await this.track([id], "STARTING", async () => {
      const containerId = await this.ensureContainer(cluster);
      await ClusterRepository.updateDesiredStatusById("RUNNING", id);
      await DockerService.startContainer(containerId);
    });

    return this.get(id);
  }

  public static async stop(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    await ClusterOperationService.run([id], async () => {
      await ClusterRepository.updateDesiredStatusById("STOPPED", id);
      await DockerService.stopContainer(cluster.containerId);
    });

    return this.get(id);
  }

  public static async restart(id: ClusterId) {
    const cluster = await this.findWithContainerId(id);

    await this.track([id], "STARTING", async () => {
      const containerId = await this.ensureContainer(cluster);
      await ClusterRepository.updateDesiredStatusById("RUNNING", id);
      await DockerService.restartContainer(containerId);
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

    await ClusterOperationService.run([id], async () => {
      await DockerService.stopContainer(containerId);
      await DockerService.removeContainer(containerId);
      await ClusterRepository.deleteById(id);
    });

    return { id, shardIds, status };
  }

  public static async getAll(): Promise<Cluster[]> {
    const clusters = await this.findManyObserved();

    return clusters.map(({ id, shardIds, status }) => ({ id, shardIds, status }));
  }

  public static async getOutdated(): Promise<ClusterId[]> {
    const [bot, containerImage, environment, clusters] = await Promise.all([
      BotRepository.findFirstIdAndToken(),
      ContainerImageRepository.findFirst(),
      EnvironmentVariableRepository.findMany(),
      ClusterRepository.findManyWithContainerId(),
    ]);
    if (bot === null || containerImage === null) return [];

    const deployment = this.deployment(bot.token, containerImage, environment);
    const labels = await DockerService.containerLabels(
      clusters.map(({ containerId }) => containerId),
    );

    return clusters
      .filter(({ containerId }) => labels.get(containerId)?.[DEPLOYMENT_LABEL] !== deployment)
      .map(({ id }) => id)
      .sort((a, b) => a - b);
  }

  public static async stopAll() {
    const clusters = await ClusterRepository.findManyIdAndContainerId();
    if (clusters.length === 0) {
      return;
    }

    const ids = clusters.map(({ id }) => id);

    return ClusterOperationService.run(ids, async () => {
      await Promise.all(
        clusters.map(({ containerId }) => DockerService.stopContainer(containerId)),
      );

      return ClusterRepository.updateManyDesiredStatusById("STOPPED", ids);
    });
  }

  public static async removeAll() {
    const clusters = await ClusterRepository.findManyIdAndContainerId();
    if (clusters.length === 0) return;

    const ids = clusters.map(({ id }) => id);

    return ClusterOperationService.run(ids, async () => {
      await Promise.all(
        clusters.map(({ containerId }) => DockerService.removeContainer(containerId)),
      );

      return ClusterRepository.deleteManyById(ids);
    });
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
    const environment = await EnvironmentVariableRepository.findMany();

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
            environment,
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
