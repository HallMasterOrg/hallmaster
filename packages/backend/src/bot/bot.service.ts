import { UUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import { ClustersService } from '../clusters/clusters.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { formatDockerImage } from './bot.utils.js';
import { CreateBotZodDto } from './dto/create-bot.dto.js';
import { GetBotZodDto } from './dto/get-bot.dto.js';
import { UpdateBotZodDto } from './dto/update-bot.dto.js';

@Injectable()
export class BotService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly clustersService: ClustersService,
  ) {}

  private static readonly BOT_SELECT = {
    id: true,
    totalShards: true,
    clusters: true,
    dockerImage: {
      select: {
        serverName: true,
        image: true,
        tag: true,
        username: true,
      },
    },
  } as const;

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
        throw new BadRequestException(`Shard ID ${shardId} is out of range [0, ${totalShards - 1}].`);
      }
    }
  }

  async getRecommendedShards(): Promise<{ shards: number }> {
    const bot = await this.prismaService.bot.findFirst({
      select: { token: true },
    });

    if (bot === null) {
      throw new NotFoundException('No bot created.');
    }

    const response = await fetch('https://discord.com/api/v10/gateway/bot', {
      headers: {
        Authorization: `Bot ${bot.token}`,
      },
    });

    if (response.status === 401) {
      throw new UnauthorizedException('Invalid Discord bot token.');
    }

    if (!response.ok) {
      throw new HttpException(
        `Discord API returned ${response.status}: ${response.statusText}`,
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    const data = (await response.json()) as { shards?: number };

    if (!data.shards || typeof data.shards !== 'number') {
      throw new HttpException('Got an invalid response from the Discord API.', HttpStatus.FAILED_DEPENDENCY);
    }

    return { shards: data.shards };
  }

  async create(createBotDto: CreateBotZodDto): Promise<GetBotZodDto> {
    try {
      const [serverName, ...path] = createBotDto.dockerImage.image.split('/');
      const [image, tag] = path.join('/').split(':');
      const bot = await this.prismaService.bot.create({
        data: {
          id: this.getBotId(createBotDto.token),
          totalShards: 0,
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
        },
        select: BotService.BOT_SELECT,
      });

      return {
        id: bot.id,
        shards: bot.totalShards,
        layout: bot.clusters.map((c) => c.shardIds),
        dockerImage: formatDockerImage(bot.dockerImage),
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
      select: BotService.BOT_SELECT,
    });

    if (null === bot) {
      throw new NotFoundException();
    }

    return {
      id: bot.id,
      shards: bot.totalShards,
      layout: bot.clusters.map((c) => c.shardIds),
      dockerImage: formatDockerImage(bot.dockerImage),
    };
  }

  async update(updateBotDto: UpdateBotZodDto): Promise<GetBotZodDto> {
    const bot = await this.prismaService.bot.findFirst({
      select: BotService.BOT_SELECT,
    });

    if (null === bot) {
      throw new NotFoundException();
    }

    const layout = updateBotDto.layout ?? bot.clusters.map((c) => c.shardIds);

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
              status: layoutChanged || bot.clusters[index]?.status !== 'STOPPED' ? 'UPDATING' : 'STOPPED',
              shardIds: clusterShardIds,
            })),
          },
        },
      },
      where: {
        id: bot.id,
      },
      select: BotService.BOT_SELECT,
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
      dockerImage: formatDockerImage(newBot.dockerImage),
    };
  }

  async remove(): Promise<GetBotZodDto> {
    const bot = await this.prismaService.bot.findFirst({
      select: BotService.BOT_SELECT,
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
      dockerImage: formatDockerImage(bot.dockerImage),
    };
  }
}
