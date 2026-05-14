import type { Readable } from 'node:stream';

import type { Cluster } from '@hallmaster/prisma-client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { DockerService } from '../docker/docker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClustersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly dockerService: DockerService,
  ) {}

  private async getFullResource(id: number) {
    const resource = await this.prismaService.cluster.findFirst({
      select: {
        bot: true,
        containerId: true,
        id: true,
        shardIds: true,
        status: true,
        botId: true,
      },
      where: { id },
    });

    if (null === resource) {
      throw new NotFoundException();
    }

    return resource;
  }

  async findAll() {
    return await this.prismaService.cluster.findMany({
      select: {
        id: true,
        shardIds: true,
        status: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const resource = await this.prismaService.cluster.findFirst({
      select: {
        id: true,
        shardIds: true,
        status: true,
      },
      where: { id },
    });

    if (null === resource) {
      throw new NotFoundException();
    }

    return resource;
  }

  async remove(id: number) {
    const resource = await this.getFullResource(id);

    await this.dockerService.remove({
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.botId,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async start(id: number) {
    const resource = await this.getFullResource(id);

    await this.dockerService.start(resource.bot, {
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.botId,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async stop(id: number) {
    const resource = await this.getFullResource(id);

    await this.dockerService.stop({
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.botId,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async stopByCluster(cluster: Cluster) {
    await this.dockerService.stop(cluster);
  }

  async restart(id: number) {
    const resource = await this.getFullResource(id);

    await this.dockerService.restart(resource.bot, {
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.botId,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async streamLogs(id: number, tail?: number | 'all'): Promise<Readable> {
    const resource = await this.getFullResource(id);
    if (null === resource.containerId) {
      throw new BadRequestException('The cluster has no container ID.');
    }
    return await this.dockerService.streamContainerLogs(resource.containerId, tail);
  }

  async logs(id: number, since?: Date, until?: Date, tail?: number | 'all') {
    const resource = await this.getFullResource(id);

    if (null === resource.containerId) {
      throw new BadRequestException('The cluster has no container ID.');
    }

    return await this.dockerService.getContainerLogs(resource.containerId, since, until, tail);
  }

  async stats(id: number) {
    const resource = await this.getFullResource(id);

    if (null === resource.containerId) {
      throw new BadRequestException('The cluster has no container ID.');
    }

    if (resource.status !== 'RUNNING') {
      throw new BadRequestException('Unable to gather stats on a non-running cluster.');
    }

    return await this.dockerService.getContainerStats(resource.containerId);
  }
}
