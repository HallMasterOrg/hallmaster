import { kill } from 'node:process';
import { spawn } from 'node:child_process';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Cluster } from '../prisma/generated/client.js';
import { HallmasterHypervisor } from './hypervisor.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RawHypervisorService implements HallmasterHypervisor {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  private async installDependencies(
    cluster: Cluster,
    sourceCodePath: string,
    env: Record<string, string>,
  ) {
    return new Promise<void>((resolve, reject) => {
      const npmChildProcess = spawn('npm install', {
        cwd: sourceCodePath,
        detached: true,
        shell: true,
        stdio: [null, 1, 2],
        env: env,
      });

      npmChildProcess.once('spawn', () => {
        console.log('npmChildProcess: spawned');
      });

      npmChildProcess.once('error', (err) => {
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
              new BadRequestException('Unable to create the cluster', {
                description: `An error occured while installing the NodeJS modules: ${err}`,
                cause: err,
              }),
            );
          });
      });

      npmChildProcess.once('close', () => {
        console.log('npmChildProcess: done');
        return resolve();
      });

      npmChildProcess.unref();
    });
  }

  private async getHandleId(
    cluster: Cluster,
    sourceCodePath: string,
    env: Record<string, string>,
  ) {
    return new Promise<string>((resolve, reject) => {
      const nodeChildProcess = spawn('node .', {
        cwd: sourceCodePath,
        detached: true,
        shell: true,
        stdio: [null, 1, 2],
        env: env,
      });

      nodeChildProcess.once('spawn', () => {
        console.log('nodeChildProcess: spawned');
      });

      nodeChildProcess.once('error', (err) => {
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
              new BadRequestException('Unable to create the cluster', {
                description: `An error occured while starting the NodeJS project: ${err}`,
                cause: err,
              }),
            );
          });
      });

      nodeChildProcess.unref();

      resolve((nodeChildProcess.pid ?? -1).toString());
    });
  }

  async start(bot: Bot, cluster: Cluster) {
    if (null !== cluster.handleId) {
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

    const sourceCodePath = bot.sourceCode;
    if (null === sourceCodePath) {
      throw new BadRequestException();
    }

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

    const customEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      [discordBotTokenEnvName]: discordBotToken,
      [totalShardsEnvName]: bot.shards.toString(),
      [shardIdListEnvName]: cluster.shardIds.join(','),
    };

    await this.installDependencies(cluster, sourceCodePath, customEnv);

    const handleId = await this.getHandleId(cluster, sourceCodePath, customEnv);

    await this.prismaService.cluster.update({
      data: {
        handleId: handleId,
        status: 'RUNNING',
      },
      where: {
        id: cluster.id,
      },
    });
  }

  async stop(_bot: Bot, cluster: Cluster) {
    if (null === cluster.handleId) {
      return;
    }

    kill(+cluster.handleId);

    await this.prismaService.cluster.update({
      data: {
        handleId: null,
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
