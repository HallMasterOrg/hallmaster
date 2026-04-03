import { UUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    private readonly clustersService: ClustersService,
  ) {}

  private getBotId(token: string): string {
    return Buffer.from(token.split('.')[0], 'base64').toString('ascii');
  }

  private validateLayout(layout: number[][]): void {
    const allShardIds = layout.flat();
    const uniqueShardIds = new Set(allShardIds);
    const totalShards = allShardIds.length;

    if (uniqueShardIds.size !== totalShards) {
      throw new BadRequestException('Duplicate shard IDs found in layout.');
    }

    for (const shardId of allShardIds) {
      if (shardId < 0 || shardId >= totalShards) {
        throw new BadRequestException(
          `Shard ID ${shardId} is out of range [0, ${totalShards - 1}].`,
        );
      }
    }
  }

  async create(createBotDto: CreateBotZodDto): Promise<GetBotZodDto> {
    this.validateLayout(createBotDto.layout);

    const totalShards = createBotDto.layout.flat().length;

    try {
      const [serverName, ...path] = createBotDto.dockerImage.image.split('/');
      const [image, tag] = path.join('/').split(':');
      const bot = await this.prismaService.bot.create({
        data: {
          id: this.getBotId(createBotDto.token),
          totalShards,
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
              data: createBotDto.layout.map((clusterShardIds) => ({
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
        shards: bot.totalShards,
        layout: bot.clusters.map((c) => c.shardIds),
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
      shards: bot.totalShards,
      layout: bot.clusters.map((c) => c.shardIds),
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

    const layout =
      updateBotDto.layout ?? bot.clusters.map((c) => c.shardIds);

    this.validateLayout(layout);

    const totalShards = layout.flat().length;
    const sortedLayout = layout.map((s) => [...s].sort((a, b) => a - b));
    const oldLayout = bot.clusters.map((c) => [...c.shardIds].sort((a, b) => a - b));
    const layoutChanged = JSON.stringify(sortedLayout) !== JSON.stringify(oldLayout);

    for (const cluster of bot.clusters) {
      await this.clustersService.remove(cluster.id as UUID);
    }

    const newBot = await this.prismaService.bot.update({
      data: {
        totalShards,
        clusters: {
          createMany: {
            data: layout.map((clusterShardIds, index) => ({
              status:
                layoutChanged || bot.clusters[index]?.status !== 'STOPPED'
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

    for (const cluster of newBot.clusters) {
      if (cluster.status !== 'STOPPED') {
        await this.clustersService.start(cluster.id as UUID);
      }
    }

    return {
      id: newBot.id,
      shards: newBot.totalShards,
      layout: newBot.clusters.map((c) => c.shardIds),
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
      shards: bot.totalShards,
      layout: bot.clusters.map((c) => c.shardIds),
    };
  }
}
