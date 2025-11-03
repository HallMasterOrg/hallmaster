import { UUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Bot, Cluster, Prisma } from '../prisma/generated/client.js';
import { DockerHypervisorService } from '../hypervisors/docker-hypervisor.service.js';
import { RawHypervisorService } from '../hypervisors/raw-hypervisor.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClustersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly dockerHypervisorService: DockerHypervisorService,
    private readonly rawHypervisorService: RawHypervisorService,
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

  private selectHypervisor(hypervisor: Bot['hypervisor']) {
    switch (hypervisor) {
      case 'DOCKER':
        return this.dockerHypervisorService;
      case 'RAW':
        return this.rawHypervisorService;
      default:
        throw new NotImplementedException();
    }
  }

  async start(bot: Bot, cluster: Cluster) {
    const hypervisor = this.selectHypervisor(bot.hypervisor);

    await hypervisor.start(bot, cluster);
  }

  async stop(bot: Bot, cluster: Cluster) {
    const hypervisor = this.selectHypervisor(bot.hypervisor);

    await hypervisor.stop(bot, cluster);
  }

  async restart(bot: Bot, cluster: Cluster) {
    const hypervisor = this.selectHypervisor(bot.hypervisor);

    await hypervisor.restart(bot, cluster);
  }

  async startById(id: UUID) {
    const resource = await this.prismaService.cluster.findUnique({
      select: {
        bot: true,
        handleId: true,
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
      handleId: resource.handleId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async stopById(id: UUID) {
    const resource = await this.prismaService.cluster.findUnique({
      select: {
        bot: true,
        handleId: true,
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
      handleId: resource.handleId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }

  async restartById(id: UUID) {
    const resource = await this.prismaService.cluster.findUnique({
      select: {
        bot: true,
        handleId: true,
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
      handleId: resource.handleId,
      botId: resource.bot.id,
      shardIds: resource.shardIds,
      status: resource.status,
    });
  }
}
