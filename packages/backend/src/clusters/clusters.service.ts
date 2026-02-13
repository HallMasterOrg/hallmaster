import { UUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DockerService } from '../docker/docker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Cluster } from '../prisma/generated/client.js';

@Injectable()
export class ClustersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly dockerService: DockerService,
  ) {}

  private async getFullResource(id: UUID) {
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

    return resource;
  }

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
    const resource = await this.getFullResource(id);

    await this.dockerService.remove({
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async start(id: UUID) {
    const resource = await this.getFullResource(id);

    await this.dockerService.start(resource.bot, {
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async stop(id: UUID) {
    const resource = await this.getFullResource(id);

    await this.dockerService.stop({
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async stopByCluster(cluster: Cluster) {
    await this.dockerService.stop(cluster);
  }

  async restart(id: UUID) {
    const resource = await this.getFullResource(id);

    await this.dockerService.restart(resource.bot, {
      id: resource.id,
      containerId: resource.containerId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async logs(id: UUID, since?: Date, until?: Date, tail?: number | 'all') {
    const resource = await this.getFullResource(id);

    if (null === resource.containerId) {
      throw new BadRequestException('The cluster has no container ID.');
    }

    return await this.dockerService.getContainerLogs(
      resource.containerId,
      since,
      until,
      tail,
    );
  }

  async stats(id: UUID) {
    const resource = await this.getFullResource(id);

    if (null === resource.containerId) {
      throw new BadRequestException('The cluster has no container ID.');
    }

    return await this.dockerService.getContainerStats(resource.containerId);
  }
}
