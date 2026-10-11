import { BadRequestException, NotFoundException } from "#exceptions/http-exceptions";
import type { Bot, ContainerImage } from "#prisma/client";
import BotRepository from "#repositories/bot.repository";
import ClusterRepository from "#repositories/cluster.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import type { Cluster, ClusterId, ClusterLogsQuery, UpdateClusters } from "#schemas/cluster.schema";

import DockerService from "./docker.service";

export default class ClusterService {
  private static async create(
    cluster: Pick<Cluster, "id" | "shardIds" | "status">,
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

    return ClusterRepository.create({
      id: cluster.id,
      botId: bot.id,
      containerId: container.Id,
      shardIds: cluster.shardIds,
      status: cluster.status,
    });
  }

  public static async get(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    return cluster;
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

  public static async start(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    if ((await ClusterRepository.updateStatusById("STARTING", id)) === null)
      throw new NotFoundException({ message: `Cluster ${id} not found` });

    await DockerService.startContainer(cluster.containerId).catch(async (error) => {
      if ((await ClusterRepository.updateStatusById("ERROR", id)) === null)
        throw new NotFoundException({ message: `Cluster ${id} not found` });

      throw error;
    });

    const updated = await ClusterRepository.updateStatusById("RUNNING", id);
    if (updated === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    return updated;
  }

  public static async stop(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    await DockerService.stopContainer(cluster.containerId).catch(async (error) => {
      if ((await ClusterRepository.updateStatusById("ERROR", id)) === null)
        throw new NotFoundException({ message: `Cluster ${id} not found` });

      throw error;
    });

    const updated = await ClusterRepository.updateStatusById("STOPPED", id);
    if (updated === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    return updated;
  }

  public static async restart(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    if ((await ClusterRepository.updateStatusById("STARTING", id)) === null)
      throw new NotFoundException({ message: `Cluster ${id} not found` });

    await DockerService.restartContainer(cluster.containerId).catch(async (error) => {
      if ((await ClusterRepository.updateStatusById("ERROR", id)) === null)
        throw new NotFoundException({ message: `Cluster ${id} not found` });

      throw error;
    });

    const updated = await ClusterRepository.updateStatusById("RUNNING", id);
    if (updated === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    return updated;
  }

  public static async remove(id: ClusterId) {
    const cluster = await ClusterRepository.findFirstContainerIdById(id);
    if (cluster === null) throw new NotFoundException({ message: `Cluster ${id} not found` });

    await DockerService.stopContainer(cluster.containerId);
    await DockerService.removeContainer(cluster.containerId);

    return ClusterRepository.deleteById(id);
  }

  public static async getAll() {
    return ClusterRepository.findMany();
  }

  public static async stopAll() {
    const clusters = await ClusterRepository.findManyIdAndContainerId();
    if (clusters.length === 0) {
      return;
    }

    await Promise.all(clusters.map(({ containerId }) => DockerService.stopContainer(containerId)));

    return ClusterRepository.updateManyStatusById(
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

    await this.stopAll();
    await this.removeAll();

    const previousStatuses = new Map(previous.map(({ id, status }) => [id, status]));
    const updated = await Promise.all(
      clusters.map((cluster) =>
        this.create(
          {
            id: cluster.id!,
            shardIds: cluster.shardIds,
            status: previousStatuses.get(cluster.id!) === "STOPPED" ? "STOPPED" : "UPDATING",
          },
          {
            ...bot,
            totalShards: shards.length,
          },
          containerImage,
        ),
      ),
    );

    return Promise.all(
      updated.map((cluster) => {
        if (cluster.status === "STOPPED") return Promise.resolve(cluster);

        return this.start(cluster.id);
      }),
    );
  }
}
