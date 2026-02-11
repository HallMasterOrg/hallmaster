import {
  DockerContainersAPI,
  DockerImagesAPI,
  DockerSocket,
} from '@hallmaster/docker.js';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Bot, Cluster } from '../prisma/generated/client.js';

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
    console.log(this.dockerToken);
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
        description: `An error occured while pulling the bot's Docker image from ${dockerRegistryImage}: ${e}`,
        cause: e,
      });
    }
  }

  async start(bot: Bot, cluster: Cluster) {
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
          description: `An error occured while starting the Docker container project: ${e}`,
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
        description: `An error occured while starting the Docker container project: ${e}`,
        cause: e,
      });
    }
  }

  async stop(_bot: Bot, cluster: Cluster) {
    if (null === cluster.containerId) {
      return;
    }

    const dockerContainersAPI = new DockerContainersAPI(this.dockerSocket);

    if (null === cluster.containerId) {
      return;
    }

    try {
      await dockerContainersAPI.stop(cluster.containerId);

      await this.prismaService.cluster.update({
        where: {
          id: cluster.id,
        },
        data: {
          status: 'STOPPED',
        },
      });
    } catch (e) {
      await this.prismaService.cluster.update({
        where: {
          id: cluster.id,
        },
        data: {
          status: 'ERROR',
        },
      });
      console.error(e);
      throw new BadRequestException('Unable to stop the cluster', {
        description: `An error occured while removing the Docker container: ${e}`,
        cause: e,
      });
    }
  }

  async remove(bot: Bot, cluster: Cluster) {
    if (null === cluster.containerId) {
      return;
    }

    if (cluster.status !== 'STOPPED' && cluster.status != 'ERROR') {
      await this.stop(bot, cluster);
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
        description: `An error occured while removing the Docker container: ${e}`,
        cause: e,
      });
    }
  }

  async restart(bot: Bot, cluster: Cluster): Promise<void> {
    if (cluster.status === 'RUNNING') {
      await this.stop(bot, cluster);
    }

    await this.start(bot, cluster);
  }

  async getContainerLogs(
    containerId: string,
    since?: Date,
    until?: Date,
    tail?: number | 'all',
  ): Promise<string> {
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
}
