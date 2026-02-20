import {
  DockerContainersAPI,
  DockerImagesAPI,
  DockerSocket,
  DockerAPIHttpError,
} from '@hallmaster/docker.js';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { GetClusterStatsZodDto } from '../clusters/dto/get-cluster-stats.dto.js';
import type { Bot, Cluster } from '@hallmaster/prisma-client';

@Injectable()
export class DockerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly dockerSocket: DockerSocket,
    private readonly dockerToken?: string,
  ) {}

  private async pullDockerImage(cluster: Cluster) {
    const dockerRegistryImage = this.configService.getOrThrow<string>(
      'DOCKER_REGISTRY_IMAGE',
    );

    const dockerImagesAPI = new DockerImagesAPI(this.dockerSocket);

    try {
      await dockerImagesAPI.create({
        fromImage: dockerRegistryImage,
        auth: this.dockerToken
          ? {
              identitytoken: this.dockerToken,
            }
          : undefined,
      });
    } catch (e) {
      await this.prismaService.cluster.updateMany({
        where: {
          id: cluster.id,
        },
        data: {
          status: 'ERROR',
        },
      });

      throw new BadRequestException('Unable to pull the Docker image.', {
        description: `An error occurred while pulling the bot's Docker image from ${dockerRegistryImage}: ${e}`,
        cause: e,
      });
    }
  }

  async start(bot: Bot, cluster: Cluster) {
    if (cluster.status === 'RUNNING') {
      return;
    }
    const dockerRegistryImage = this.configService.getOrThrow<string>(
      'DOCKER_REGISTRY_IMAGE',
    );
    const discordBotToken =
      this.configService.getOrThrow<string>('DISCORD_BOT_TOKEN');

    const discordBotTokenEnvName = this.configService.getOrThrow<string>(
      'DISCORD_BOT_TOKEN_ENV_NAME',
    );

    const totalShardsEnvName = this.configService.getOrThrow<string>(
      'TOTAL_SHARDS_ENV_NAME',
    );

    const shardIdListEnvName = this.configService.getOrThrow<string>(
      'SHARD_ID_LIST_ENV_NAME',
    );

    await this.prismaService.cluster.update({
      data: {
        status: 'STARTING',
      },
      where: {
        id: cluster.id,
      },
    });

    const dockerContainersAPI = new DockerContainersAPI(this.dockerSocket);
    let containerId: null | string = cluster.containerId;

    if (null === containerId) {
      await this.pullDockerImage(cluster);
      try {
        const container = await dockerContainersAPI.create(
          {
            Env: [
              `${discordBotTokenEnvName}=${discordBotToken}`,
              `${totalShardsEnvName}=${bot.shards}`,
              `${shardIdListEnvName}=${cluster.shardIds.join(',')}`,
            ],
            Image: dockerRegistryImage,
          },
          `${bot.id}-${cluster.id}`,
        );

        containerId = container.Id;

        await this.prismaService.cluster.update({
          where: {
            botId: bot.id,
            id: cluster.id,
          },
          data: {
            status: 'STOPPED',
            containerId: containerId,
          },
        });
      } catch (e) {
        await this.prismaService.cluster.update({
          where: {
            botId: bot.id,
            id: cluster.id,
          },
          data: {
            status: 'ERROR',
          },
        });

        throw new BadRequestException('Unable to create the cluster', {
          description: `An error occurred while starting the Docker container project: ${e}`,
          cause: e,
        });
      }
    }

    if (null === containerId) {
      throw new InternalServerErrorException();
    }

    try {
      await dockerContainersAPI.start(containerId);

      await this.prismaService.cluster.update({
        where: {
          botId: bot.id,
          id: cluster.id,
        },
        data: {
          status: 'RUNNING',
          containerId: containerId,
        },
      });

      return containerId;
    } catch (e) {
      await this.prismaService.cluster.update({
        where: {
          botId: bot.id,
          id: cluster.id,
        },
        data: {
          status: 'ERROR',
        },
      });

      throw new BadRequestException('Unable to create the cluster', {
        description: `An error occurred while starting the Docker container project: ${e}`,
        cause: e,
      });
    }
  }

  async stop(cluster: Cluster) {
    if (null === cluster.containerId) {
      return;
    }

    const dockerContainersAPI = new DockerContainersAPI(this.dockerSocket);

    try {
      const container = await dockerContainersAPI.get(cluster.containerId);

      await dockerContainersAPI.stop(container.Id);
    } catch (e) {
      if (
        !(e instanceof DockerAPIHttpError) ||
        e.message !== `no such container: ${cluster.containerId}`
      ) {
        await this.prismaService.cluster.update({
          where: {
            id: cluster.id,
          },
          data: {
            status: 'ERROR',
          },
        });

        throw new BadRequestException('Unable to stop the cluster', {
          description: `An error occurred while removing the Docker container: ${e}`,
          cause: e,
        });
      }
    }

    await this.prismaService.cluster.update({
      where: {
        id: cluster.id,
      },
      data: {
        status: 'STOPPED',
      },
    });
  }

  async remove(cluster: Cluster) {
    if (null === cluster.containerId) {
      return;
    }

    if (cluster.status !== 'STOPPED' && cluster.status !== 'ERROR') {
      await this.stop(cluster);
    }

    const dockerContainersAPI = new DockerContainersAPI(this.dockerSocket);

    try {
      await dockerContainersAPI.remove(cluster.containerId);

      await this.prismaService.cluster.delete({
        where: {
          id: cluster.id,
        },
      });
    } catch (e) {
      throw new BadRequestException('Unable to remove the cluster', {
        description: `An error occurred while removing the Docker container: ${e}`,
        cause: e,
      });
    }
  }

  async restart(bot: Bot, cluster: Cluster): Promise<void> {
    if (cluster.status === 'RUNNING') {
      await this.stop(cluster);
    }

    await this.start(bot, cluster);
  }

  async getContainerLogs(
    containerId: string,
    since?: Date,
    until?: Date,
    tail?: number | 'all',
  ) {
    const dockerContainersAPI = new DockerContainersAPI(this.dockerSocket);

    const sinceTimestamp = since ? since.getTime() / 1000 : undefined;
    const untilTimestamp = until ? until.getTime() / 1000 : undefined;

    return await dockerContainersAPI.logs(containerId, {
      stdout: true,
      stderr: true,
      timestamps: true,
      follow: false,
      since: sinceTimestamp,
      until: untilTimestamp,
      tail: tail,
    });
  }

  async getContainerStats(id: string): Promise<GetClusterStatsZodDto> {
    const dockerContainersAPI = new DockerContainersAPI(this.dockerSocket);

    const stats = await dockerContainersAPI.stats(id, {
      oneShot: false,
      stream: false,
    });

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;

    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

    const onlineCPUs =
      stats.cpu_stats.online_cpus ??
      stats.cpu_stats.cpu_usage.percpu_usage?.length ??
      1;

    const cpuPercentage =
      systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCPUs * 100 : 0;

    const processesUsage = stats.pids_stats.current;
    const processesPercentage = (processesUsage / stats.pids_stats.limit) * 100;

    const memoryUsage =
      stats.memory_stats.usage -
      stats.memory_stats.stats.inactive_file -
      stats.memory_stats.stats.slab_reclaimable;

    const memoryPercentage = (memoryUsage / stats.memory_stats.limit) * 100;

    const diskRead = stats.blkio_stats.io_service_bytes_recursive
      ?.filter((service) => service.op === 'read')
      ?.reduce((acc, cur) => acc + cur.value, 0);
    const diskWrite = stats.blkio_stats.io_service_bytes_recursive
      ?.filter((service) => service.op === 'write')
      ?.reduce((acc, cur) => acc + cur.value, 0);

    const networks = Object.entries(stats.networks).map(
      ([interfaceName, data]) => ({
        interface: interfaceName,
        transmitted: data.tx_bytes,
        received: data.rx_bytes,
      }),
    );

    return {
      cpuPercentage: cpuPercentage,
      processes: {
        usage: processesUsage,
        percentage: processesPercentage,
      },
      memory: {
        usage: memoryUsage,
        percentage: memoryPercentage,
      },
      disk: {
        read: diskRead ?? null,
        write: diskWrite ?? null,
      },
      networks: networks,
    };
  }
}
