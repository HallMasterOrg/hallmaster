import { spawn } from 'node:child_process';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { Bot, Cluster } from '../prisma/generated/client.js';

@Injectable()
export class DockerService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  private async pullDockerImage(cluster: Cluster) {
    const dockerRegistryImage = this.configService.getOrThrow<string>(
      'DOCKER_REGISTRY_IMAGE',
    );

    return new Promise<void>((resolve, reject) => {
      const dockerPullProcess = spawn(`docker pull ${dockerRegistryImage}`, {
        shell: true,
        stdio: [null, 1, 2],
      });

      dockerPullProcess.once('error', (err) => {
        this.prismaService.cluster
          .updateMany({
            where: {
              id: cluster.id,
            },
            data: {
              status: 'ERROR',
            },
          })
          .catch(console.error) // TODO: replace with the logger.
          .finally(() => {
            return reject(
              new BadRequestException('Unable to pull the Docker image.', {
                description: `An error occured while pulling the bot's Docker image from ${dockerRegistryImage}: ${err}`,
                cause: err,
              }),
            );
          });
      });

      dockerPullProcess.once('close', resolve);

      dockerPullProcess.unref();
    });
  }

  private async stopDockerContainer(cluster: Cluster) {
    return new Promise<void>((resolve, reject) => {
      const dockerPullProcess = spawn(`docker stop ${cluster.containerId}`, {
        shell: true,
        stdio: [null, 1, 2],
      });

      dockerPullProcess.once('error', (err) => {
        this.prismaService.cluster
          .updateMany({
            where: {
              id: cluster.id,
            },
            data: {
              status: 'ERROR',
            },
          })
          .catch(console.error) // TODO: replace with the logger.
          .finally(() => {
            return reject(
              new BadRequestException('Unable to stop the cluster', {
                description: `An error occured while removing the Docker container: ${err}`,
                cause: err,
              }),
            );
          });
      });

      dockerPullProcess.once('close', resolve);

      dockerPullProcess.unref();
    });
  }

  private async getHandleId(
    botId: string,
    totalShards: number,
    shardIds: number[],
  ) {
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

    return new Promise<string>((resolve, reject) => {
      const dockerRunProcess = spawn('docker', [
        'run',
        '--rm',
        '-e',
        `${discordBotTokenEnvName}=${discordBotToken}`,
        '-e',
        `${totalShardsEnvName}=${totalShards}`,
        '-e',
        `${shardIdListEnvName}=${shardIds.join(',')}`,
        '-d',
        dockerRegistryImage,
      ]);

      let containerId: string = '';

      dockerRunProcess.stdout?.once('data', (chunk) => {
        containerId += Buffer.from(chunk).toString('ascii');
      });

      dockerRunProcess.once('error', (err) => {
        this.prismaService.cluster
          .updateMany({
            where: {
              botId,
            },
            data: {
              status: 'ERROR',
            },
          })
          .catch(console.error) // TODO: replace with the logger.
          .finally(() => {
            return reject(
              new BadRequestException('Unable to create the cluster', {
                description: `An error occured while starting the Docker container project: ${err}`,
                cause: err,
              }),
            );
          });
      });

      dockerRunProcess.once('close', () => {
        resolve(containerId);
      });

      dockerRunProcess.unref();
    });
  }

  async start(bot: Bot, cluster: Cluster) {
    if (null !== cluster.containerId) {
      return;
    }

    await this.prismaService.cluster.update({
      data: {
        status: 'STARTING',
      },
      where: {
        id: cluster.id,
      },
    });

    await this.pullDockerImage(cluster);

    const containerId = await this.getHandleId(
      bot.id,
      bot.shards,
      cluster.shardIds,
    );

    await this.prismaService.cluster.update({
      data: {
        containerId: containerId,
        status: 'RUNNING',
      },
      where: {
        id: cluster.id,
      },
    });
  }

  async stop(_bot: Bot, cluster: Cluster) {
    if (null === cluster.containerId) {
      return;
    }

    await this.stopDockerContainer(cluster);

    await this.prismaService.cluster.update({
      data: {
        containerId: null,
        status: 'STOPPED',
      },
      where: {
        id: cluster.id,
      },
    });
  }

  async restart(bot: Bot, cluster: Cluster): Promise<void> {
    if (cluster.status === 'RUNNING') {
      await this.stop(bot, cluster);
    }

    await this.start(bot, cluster);
  }
}
