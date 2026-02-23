import { UUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClustersService } from '../clusters/clusters.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBotZodDto } from './dto/create-bot.dto.js';
import { GetBotZodDto } from './dto/get-bot.dto.js';
import { UpdateBotZodDto } from './dto/update-bot.dto.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

@Injectable()
export class BotService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly clustersService: ClustersService,
  ) {}

  private getBotId(token: string): string {
    return Buffer.from(token.split('.')[0], 'base64').toString('ascii');
  }

  private async computeRecommendedShards(shards?: number): Promise<number> {
    if (undefined !== shards) {
      return Promise.resolve(shards);
    }
    // TODO: connect to the Discord API to compute the recommended shard number.
    throw new NotImplementedException();
  }

  private computeClusters(
    clusterNumber: number,
    shards: number,
    shardsPerCluster: number,
  ) {
    const newClusters: number[][] = [];
    if (clusterNumber < Math.ceil(shards / shardsPerCluster)) {
      clusterNumber = Math.ceil(shards / shardsPerCluster);
    }

    for (let i = 0; i < clusterNumber; ++i) {
      newClusters.push([]);
    }

    let clusterIndex = 0;
    for (let i = 0; i < shards; ++i) {
      if (i % shardsPerCluster === 0 && i > 0) {
        ++clusterIndex;
      }
      newClusters[clusterIndex].push(i);
    }

    return newClusters;
  }

  async create(createBotDto: CreateBotZodDto): Promise<GetBotZodDto> {
    const shards = await this.computeRecommendedShards(createBotDto.shards);

    const shardsPerCluster =
      this.configService.getOrThrow<number>('SHARDS_PER_CLUSTER');

    const newClusters = this.computeClusters(
      createBotDto.clusters ?? 1,
      shards,
      shardsPerCluster,
    );

    try {
      const [serverName, ...path] = createBotDto.dockerImage.image.split('/');
      const [image, tag] = path.join('/').split(':');
      const bot = await this.prismaService.bot.create({
        data: {
          id: this.getBotId(createBotDto.token),
          totalShards: shards,
          token: createBotDto.token,
          dockerImage: {
            create: {
              image: image,
              tag: tag,
              serverName: serverName,
              username: createBotDto.dockerImage.username,
              password: createBotDto.dockerImage.password,
            },
          },
          clusters: {
            createMany: {
              data: newClusters.map((clusterShardIds) => ({
                status: 'STOPPED',
                shardIds: clusterShardIds,
              })),
            },
          },
        },
        select: {
          id: true,
          clusters: true,
          totalShards: true,
        },
      });

      return {
        id: bot.id,
        clusters: bot.clusters.length,
        shards: bot.totalShards,
      };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2002' === e.code) {
        throw new ConflictException();
      }
      throw e;
    }
  }

  async findOne(): Promise<GetBotZodDto> {
    const bot = await this.prismaService.bot.findFirst({
      select: {
        id: true,
        totalShards: true,
        clusters: true,
      },
    });

    if (null === bot) {
      throw new NotFoundException();
    }

    return {
      id: bot.id,
      clusters: bot.clusters.length,
      shards: bot.totalShards,
    };
  }

  async update(updateBotDto: UpdateBotZodDto): Promise<GetBotZodDto> {
    const bot = await this.prismaService.bot.findFirst({
      select: {
        id: true,
        totalShards: true,
        clusters: true,
      },
    });

    if (null === bot) {
      throw new NotFoundException();
    }

    for (const cluster of bot.clusters) {
      await this.clustersService.remove(cluster.id as UUID);
    }

    const shards = await this.computeRecommendedShards(
      updateBotDto.shards ?? bot.totalShards,
    );

    const shardsPerCluster =
      this.configService.getOrThrow<number>('SHARDS_PER_CLUSTER');

    const newClusters = this.computeClusters(
      updateBotDto.clusters ?? bot.clusters.length,
      shards,
      shardsPerCluster,
    );

    const newBot = await this.prismaService.bot.update({
      data: {
        totalShards: shards,
        clusters: {
          createMany: {
            data: newClusters.map((clusterShardIds, index) => ({
              status:
                bot.clusters[index]?.status !== 'STOPPED'
                  ? 'UPDATING'
                  : 'STOPPED',
              shardIds: clusterShardIds,
            })),
          },
        },
      },
      where: {
        id: bot.id,
      },
      select: {
        id: true,
        totalShards: true,
        clusters: true,
      },
    });

    for (
      let clusterIndex = 0;
      clusterIndex < newBot.clusters.length;
      ++clusterIndex
    ) {
      const cluster = newBot.clusters[clusterIndex];
      if (cluster?.status !== 'STOPPED') {
        await this.clustersService.start(cluster.id as UUID);
      }
    }

    return {
      id: newBot.id,
      clusters: newBot.clusters.length,
      shards: newBot.totalShards,
    };
  }

  async remove(): Promise<GetBotZodDto> {
    const bot = await this.prismaService.bot.findFirst({
      select: { id: true, totalShards: true, clusters: true },
    });
    if (null === bot) {
      throw new NotFoundException();
    }

    try {
      await this.prismaService.bot.delete({
        where: {
          id: bot.id,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2025' === e.code) {
        throw new NotFoundException();
      }
      throw e;
    }

    for (const cluster of bot.clusters) {
      await this.clustersService.stopByCluster(cluster);
    }

    return {
      id: bot.id,
      clusters: bot.clusters.length,
      shards: bot.totalShards,
    };
  }
}
