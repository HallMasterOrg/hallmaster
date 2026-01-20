import { UUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Bot, Cluster, Prisma } from '../prisma/generated/client.js';
import { DockerService } from '../docker/docker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClustersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly dockerService: DockerService,
  ) {}

  async findAll() {
    const resources = await this.prismaService.cluster.findMany({
      select: {
        id: true,
        shardIds: true,
        status: true,
      },
    });

    return resources;
  }

  async findOne(id: UUID) {
    const resource = await this.prismaService.cluster.findUnique({
      select: {
        id: true,
        shardIds: true,
        status: true,
      },
      where: {
        id,
      },
    });

    if (null === resource) {
      throw new NotFoundException();
    }

    return resource;
  }

  async remove(id: UUID) {
    await this.stopById(id);

    try {
      const removedResource = await this.prismaService.cluster.delete({
        select: {
          id: true,
          shardIds: true,
          status: true,
        },
        where: {
          id,
        },
      });

      return removedResource;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        'P2025' == e.code
      ) {
        throw new NotFoundException();
      }
      throw e;
    }
  }

  async start(bot: Bot, cluster: Cluster) {
    await this.dockerService.start(bot, cluster);
  }

  async stop(bot: Bot, cluster: Cluster) {
    await this.dockerService.stop(bot, cluster);
  }

  async restart(bot: Bot, cluster: Cluster) {
    await this.dockerService.restart(bot, cluster);
  }

  async startById(id: UUID) {
    const resource = await this.prismaService.cluster.findUnique({
      select: {
        bot: true,
        containerId: true,
        id: true,
        shardIds: true,
        status: true,
      },
      where: {
        id,
      },
    });

    if (null === resource) {
      throw new NotFoundException();
    }

    await this.start(resource.bot, {
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async stopById(id: UUID) {
    const resource = await this.prismaService.cluster.findUnique({
      select: {
        bot: true,
        containerId: true,
        id: true,
        shardIds: true,
        status: true,
      },
      where: {
        id,
      },
    });

    if (null === resource) {
      throw new NotFoundException();
    }

    await this.stop(resource.bot, {
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async restartById(id: UUID) {
    const resource = await this.prismaService.cluster.findUnique({
      select: {
        bot: true,
        containerId: true,
        id: true,
        shardIds: true,
        status: true,
      },
      where: {
        id,
      },
    });

    if (null === resource) {
      throw new NotFoundException();
    }

    await this.restart(resource.bot, {
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }
}
