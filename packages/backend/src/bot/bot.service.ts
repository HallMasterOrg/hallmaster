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
import { DockerService } from '../docker/docker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { formatDockerImage } from './bot.utils.js';
import { CreateBotZodDto } from './dto/create-bot.dto.js';
import { GetBotZodDto } from './dto/get-bot.dto.js';
import { UpdateBotZodDto } from './dto/update-bot.dto.js';

type LayoutInput = NonNullable<UpdateBotZodDto['layout']>;

@Injectable()
export class BotService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly clustersService: ClustersService,
    private readonly dockerService: DockerService,
  ) {}

  private parseDockerImage(image: string): { serverName: string; image: string; tag: string } {
    const [serverName, ...path] = image.trim().split('/');
    const [imageName, tag] = path.join('/').split(':');
    return { serverName, image: imageName, tag };
  }

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

  private validateLayout(layout: LayoutInput, existingClusterIds: Set<number>): void {
    const providedIds = new Set<number>();
    for (const [index, cluster] of layout.entries()) {
      if (cluster.shardIds.length === 0) {
        throw new BadRequestException(`Cluster at index ${index} is empty.`);
      }
      if (cluster.id !== undefined) {
        if (providedIds.has(cluster.id)) {
          throw new BadRequestException(`Duplicate cluster ID ${cluster.id} in layout.`);
        }
        if (!existingClusterIds.has(cluster.id)) {
          throw new BadRequestException(`Cluster ID ${cluster.id} does not exist.`);
        }
        providedIds.add(cluster.id);
      }
    }

    const allShardIds = layout.flatMap((c) => c.shardIds);
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

  private assignClusterIds(layout: LayoutInput): Array<{ id: number; shardIds: number[] }> {
    const sorted = [...layout].sort((a, b) => Math.min(...a.shardIds) - Math.min(...b.shardIds));

    const usedIds = new Set<number>();
    for (const cluster of sorted) {
      if (cluster.id !== undefined) usedIds.add(cluster.id);
    }

    let candidate = 0;
    return sorted.map((cluster) => {
      if (cluster.id !== undefined) {
        return { id: cluster.id, shardIds: cluster.shardIds };
      }
      while (usedIds.has(candidate)) candidate++;
      const id = candidate++;
      usedIds.add(id);
      return { id, shardIds: cluster.shardIds };
    });
  }

  private async fetchDiscordGatewayBot(token: string): Promise<{ shards: number }> {
    let response: Response;
    try {
      response = await fetch('https://discord.com/api/v10/gateway/bot', {
        headers: {
          Authorization: `Bot ${token}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new HttpException('The Discord API is unreachable or timed out.', HttpStatus.FAILED_DEPENDENCY);
    }

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

  async getRecommendedShards(): Promise<{ shards: number }> {
    const bot = await this.prismaService.bot.findFirst({
      select: { token: true },
    });

    if (bot === null) {
      throw new NotFoundException('No bot created.');
    }

    return await this.fetchDiscordGatewayBot(bot.token);
  }

  async create(createBotDto: CreateBotZodDto): Promise<GetBotZodDto> {
    await this.fetchDiscordGatewayBot(createBotDto.token);

    const { serverName, image, tag } = this.parseDockerImage(createBotDto.dockerImage.image);

    await this.dockerService.verifyImage({
      serverName,
      image,
      tag,
      username: createBotDto.dockerImage.username ?? null,
      password: createBotDto.dockerImage.password ?? null,
    });

    try {
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
        layout: bot.clusters.map((c) => ({ id: c.id, shardIds: c.shardIds })),
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
      layout: bot.clusters.map((c) => ({ id: c.id, shardIds: c.shardIds })),
      dockerImage: formatDockerImage(bot.dockerImage),
    };
  }

  private buildDockerImageUpdate(
    input: UpdateBotZodDto['dockerImage'],
    current: {
      serverName: string;
      image: string;
      tag: string;
      username: string | null;
    } | null,
  ):
    | {
        serverName?: string;
        image?: string;
        tag?: string;
        username?: string | null;
        password?: string | null;
      }
    | undefined {
    if (!input) {
      return undefined;
    }

    const update: {
      serverName?: string;
      image?: string;
      tag?: string;
      username?: string | null;
      password?: string | null;
    } = {};

    if (input.image !== undefined) {
      const { serverName, image, tag } = this.parseDockerImage(input.image);
      if (current === null || serverName !== current.serverName || image !== current.image || tag !== current.tag) {
        update.serverName = serverName;
        update.image = image;
        update.tag = tag;
      }
    }

    if (input.username !== undefined && input.username !== current?.username) {
      update.username = input.username;
    }

    if (input.password !== undefined) {
      update.password = input.password;
    }

    return Object.keys(update).length > 0 ? update : undefined;
  }

  async update(updateBotDto: UpdateBotZodDto): Promise<GetBotZodDto> {
    const bot = await this.prismaService.bot.findFirst({
      select: {
        ...BotService.BOT_SELECT,
        token: true,
      },
    });

    if (null === bot) {
      throw new NotFoundException();
    }

    const existingClusterIds = new Set(bot.clusters.map((c) => c.id));

    const layoutInput: LayoutInput =
      updateBotDto.layout ?? bot.clusters.map((c) => ({ id: c.id, shardIds: c.shardIds }));

    this.validateLayout(layoutInput, existingClusterIds);

    const resolvedLayout = this.assignClusterIds(layoutInput);
    const totalShards = resolvedLayout.flatMap((c) => c.shardIds).length;

    const sortedLayout = resolvedLayout
      .map((c) => ({ id: c.id, shardIds: [...c.shardIds].sort((a, b) => a - b) }))
      .sort((a, b) => a.id - b.id);
    const oldLayout = bot.clusters
      .map((c) => ({ id: c.id, shardIds: [...c.shardIds].sort((a, b) => a - b) }))
      .sort((a, b) => a.id - b.id);
    const layoutChanged = JSON.stringify(sortedLayout) !== JSON.stringify(oldLayout);

    const newToken = updateBotDto.token !== undefined && updateBotDto.token !== bot.token ? updateBotDto.token : null;
    const tokenChanged = newToken !== null;

    if (newToken !== null) {
      await this.fetchDiscordGatewayBot(newToken);
    }

    const dockerImageUpdate = this.buildDockerImageUpdate(updateBotDto.dockerImage, bot.dockerImage);
    const dockerImageChanged = dockerImageUpdate !== undefined;

    if (dockerImageUpdate !== undefined) {
      const currentImage = await this.prismaService.dockerImage.findUniqueOrThrow({
        where: { botId: bot.id },
        select: { serverName: true, image: true, tag: true, username: true, password: true },
      });
      await this.dockerService.verifyImage({
        serverName: dockerImageUpdate.serverName ?? currentImage.serverName,
        image: dockerImageUpdate.image ?? currentImage.image,
        tag: dockerImageUpdate.tag ?? currentImage.tag,
        username: dockerImageUpdate.username !== undefined ? dockerImageUpdate.username : currentImage.username,
        password: dockerImageUpdate.password !== undefined ? dockerImageUpdate.password : currentImage.password,
      });
    }

    const shouldForceRestart = layoutChanged || tokenChanged || dockerImageChanged;

    const oldStatusById = new Map(bot.clusters.map((c) => [c.id, c.status]));

    for (const cluster of bot.clusters) {
      await this.clustersService.remove(cluster.id);
    }

    const newBot = await this.prismaService.bot.update({
      data: {
        totalShards,
        ...(newToken !== null && { token: newToken }),
        ...(dockerImageChanged && {
          dockerImage: { update: dockerImageUpdate },
        }),
        clusters: {
          createMany: {
            data: resolvedLayout.map((cluster) => ({
              id: cluster.id,
              status: shouldForceRestart || oldStatusById.get(cluster.id) !== 'STOPPED' ? 'UPDATING' : 'STOPPED',
              shardIds: cluster.shardIds,
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
        await this.clustersService.start(cluster.id);
      }
    }

    return {
      id: newBot.id,
      shards: newBot.totalShards,
      layout: newBot.clusters.map((c) => ({ id: c.id, shardIds: c.shardIds })),
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
      layout: bot.clusters.map((c) => ({ id: c.id, shardIds: c.shardIds })),
      dockerImage: formatDockerImage(bot.dockerImage),
    };
  }
}
