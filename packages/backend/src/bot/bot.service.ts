import path from 'node:path';
import { tmpdir } from 'node:os';
import { UUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { Extract } from 'unzipper';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { MemoryStoredFile } from 'nestjs-form-data';
import { ConfigService } from '@nestjs/config';
import { Cluster, Hypervisor, Prisma } from '../prisma/generated/client.js';
import { CreateBotDto } from './dto/create-bot.dto.js';
import { UpdateBotDto } from './dto/update-bot.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClustersService } from '../clusters/clusters.service.js';
import { Bot } from './entities/bot.entity.js';

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

  private async handleSourceCodeUpload(
    sourceCode?: MemoryStoredFile,
  ): Promise<string | undefined> {
    if (undefined === sourceCode) return undefined;

    const botPath = await mkdtemp(path.join(tmpdir(), 'hallmaster-bot-'));
    await mkdir(botPath, { mode: 0o600, recursive: true });

    const stream = Extract({ path: botPath });
    stream.write(sourceCode.buffer);
    stream.end();
    await stream.promise();
    return botPath;
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
    for (let i = 0; i < clusterNumber; ++i) {
      newClusters.push([]);
    }

    let clusterIndex = 0;
    for (let i = 0; i < shards; ++i) {
      newClusters[clusterIndex].push(i);
      if (i % shardsPerCluster === 0 && i > 0) {
        ++clusterIndex;
      }
    }

    return newClusters;
  }

  async create(createBotDto: CreateBotDto): Promise<Bot> {
    const botId = this.getBotId();

    const sourceCode = await this.handleSourceCodeUpload(
      createBotDto.sourceCode as unknown as MemoryStoredFile | undefined,
    );

    const shards = await this.computeRecommendedShards(createBotDto.shards);

    const clusterNumber = createBotDto.clusters;

    const shardsPerCluster =
      this.configService.getOrThrow<number>('SHARDS_PER_CLUSTER');

    const newClusters = this.computeClusters(
      clusterNumber,
      shards,
      shardsPerCluster,
    );

    try {
      const createdResource = await this.prismaService.bot.create({
        data: {
          id: botId,
          clusterNumber: createBotDto.clusters,
          shards: shards,
          sourceCode: sourceCode,
          hypervisor: sourceCode ? 'RAW' : 'DOCKER',
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
          hypervisor: true,
        },
      });

      return {
        id: createdResource.id,
        clusters: createdResource.clusterNumber,
        shards: createdResource.shards,
        hypervisor: createdResource.hypervisor,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        'P2002' === e.code
      ) {
        throw new ConflictException();
      }
      throw e;
    }
  }

  async findOne(): Promise<Bot> {
    const resource = await this.prismaService.bot.findFirst({
      select: {
        id: true,
        clusterNumber: true,
        shards: true,
        hypervisor: true,
      },
    });

    if (null === resource) {
      throw new NotFoundException();
    }
    return {
      id: resource.id,
      clusters: resource.clusterNumber,
      shards: resource.shards,
      hypervisor: resource.hypervisor,
    };
  }

  async update(updateBotDto: UpdateBotDto): Promise<Bot> {
    const botId = this.getBotId();

    const currentResource = await this.prismaService.bot.findFirst();
    if (null === currentResource) {
      throw new NotFoundException();
    }

    if (undefined !== updateBotDto.sourceCode) {
      if (null !== currentResource.sourceCode) {
        await rm(currentResource.sourceCode, { force: true, recursive: true });
      }

      const sourceCode = await this.handleSourceCodeUpload(
        updateBotDto.sourceCode as unknown as MemoryStoredFile | undefined,
      );
      currentResource.sourceCode = sourceCode ?? null;
    }

    const currentClusters = await this.prismaService.cluster.findMany({
      where: {
        bot: {
          id: botId,
        },
      },
    });

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

    await this.prismaService.bot.update({
      data: {
        clusterNumber: clusterNumber,
        shards: shards,
        hypervisor: undefined === updateBotDto.sourceCode ? 'DOCKER' : 'RAW',
        clusters: {
          createMany: {
            data: newClusters.map((clusterShardIds, index) => ({
              status: currentClusters[index]?.status ?? 'STOPPED',
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
        sourceCode: true,
        clusterNumber: true,
        clusters: true,
        hypervisor: true,
      },
    });

    for (const cluster of currentClusters) {
      await this.clustersService.remove(cluster.id as UUID);
    }

    const newResource = await this.prismaService.bot.findUniqueOrThrow({
      where: {
        id: botId,
      },
      select: {
        id: true,
        shards: true,
        sourceCode: true,
        clusterNumber: true,
        clusters: true,
        hypervisor: true,
      },
    });

    for (
      let clusterIndex = 0;
      clusterIndex < newResource.clusters.length;
      ++clusterIndex
    ) {
      const currentCluster = currentClusters[clusterIndex];
      if (currentCluster?.status !== 'STOPPED') {
        const cluster = newResource.clusters[clusterIndex];
        await this.clustersService.start(newResource, cluster);
      }
    }

    return {
      id: newResource.id,
      clusters: newResource.clusterNumber,
      shards: newResource.shards,
      hypervisor: newResource.hypervisor,
    };
  }

  async remove(): Promise<Bot> {
    let deletedResource: {
      id: string;
      clusterNumber: number;
      shards: number;
      sourceCode: string | null;
      hypervisor: Hypervisor;
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
          hypervisor: true,
          sourceCode: true,
          clusters: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        'P2025' === e.code
      ) {
        throw new NotFoundException();
      }
      throw e;
    }

    for (const cluster of deletedResource.clusters) {
      await this.clustersService.stop(deletedResource, cluster);
    }

    return {
      id: deletedResource.id,
      clusters: deletedResource.clusterNumber,
      shards: deletedResource.shards,
      hypervisor: deletedResource.hypervisor,
    };
  }
}
