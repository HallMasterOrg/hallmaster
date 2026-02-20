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
import { type Cluster } from '@hallmaster/prisma-client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

@Injectable()
export class BotService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly clustersService: ClustersService,
  ) {}

  private getBotId(): string {
    const botToken = this.configService.getOrThrow<string>('DISCORD_BOT_TOKEN');
    const botId = Buffer.from(botToken.split('.')[0], 'base64').toString(
      'ascii',
    );
    return botId;
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
    if (clusterNumber < shards / shardsPerCluster) {
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
    const botId = this.getBotId();

    const shards = await this.computeRecommendedShards(createBotDto.shards);

    const clusterNumber = createBotDto.clusters;

    const shardsPerCluster =
      this.configService.getOrThrow<number>('SHARDS_PER_CLUSTER');

    const newClusters = this.computeClusters(
      clusterNumber ?? 1,
      shards,
      shardsPerCluster,
    );

    try {
      const createdResource = await this.prismaService.bot.create({
        data: {
          id: botId,
          clusterNumber: createBotDto.clusters ?? 1,
          shards: shards,
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
          clusterNumber: true,
          shards: true,
        },
      });

      return {
        id: createdResource.id,
        clusters: createdResource.clusterNumber,
        shards: createdResource.shards,
      };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2002' === e.code) {
        throw new ConflictException();
      }
      throw e;
    }
  }

  async findOne(): Promise<GetBotZodDto> {
    const resource = await this.prismaService.bot.findFirst({
      select: {
        id: true,
        clusterNumber: true,
        shards: true,
      },
    });

    if (null === resource) {
      throw new NotFoundException();
    }
    return {
      id: resource.id,
      clusters: resource.clusterNumber,
      shards: resource.shards,
    };
  }

  async update(updateBotDto: UpdateBotZodDto): Promise<GetBotZodDto> {
    const botId = this.getBotId();

    const currentResource = await this.prismaService.bot.findFirst();
    if (null === currentResource) {
      throw new NotFoundException();
    }

    const currentClusters = await this.prismaService.cluster.findMany({
      where: {
        bot: {
          id: botId,
        },
      },
    });

    for (const cluster of currentClusters) {
      await this.clustersService.remove(cluster.id as UUID);
    }

    const clusterNumber =
      updateBotDto.clusters ?? currentResource.clusterNumber;

    const shards = await this.computeRecommendedShards(
      updateBotDto.shards ?? currentResource.shards,
    );

    const shardsPerCluster =
      this.configService.getOrThrow<number>('SHARDS_PER_CLUSTER');

    const newClusters = this.computeClusters(
      clusterNumber,
      shards,
      shardsPerCluster,
    );

    const newResource = await this.prismaService.bot.update({
      data: {
        clusterNumber: clusterNumber,
        shards: shards,
        clusters: {
          createMany: {
            data: newClusters.map((clusterShardIds, index) => ({
              status:
                currentClusters[index]?.status !== 'STOPPED'
                  ? 'UPDATING'
                  : 'STOPPED',
              shardIds: clusterShardIds,
            })),
          },
        },
      },
      where: {
        id: botId,
      },
      select: {
        id: true,
        shards: true,
        clusterNumber: true,
        clusters: true,
      },
    });

    for (
      let clusterIndex = 0;
      clusterIndex < newResource.clusters.length;
      ++clusterIndex
    ) {
      const cluster = newResource.clusters[clusterIndex];
      if (cluster?.status !== 'STOPPED') {
        await this.clustersService.start(cluster.id as UUID);
      }
    }

    return {
      id: newResource.id,
      clusters: newResource.clusterNumber,
      shards: newResource.shards,
    };
  }

  async remove(): Promise<GetBotZodDto> {
    let deletedResource: {
      id: string;
      clusterNumber: number;
      shards: number;
      clusters: Cluster[];
    };

    try {
      deletedResource = await this.prismaService.bot.delete({
        where: {
          id: this.getBotId(),
        },
        select: {
          id: true,
          clusterNumber: true,
          shards: true,
          clusters: true,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2025' === e.code) {
        throw new NotFoundException();
      }
      throw e;
    }

    for (const cluster of deletedResource.clusters) {
      await this.clustersService.stopByCluster(cluster);
    }

    return {
      id: deletedResource.id,
      clusters: deletedResource.clusterNumber,
      shards: deletedResource.shards,
    };
  }
}
