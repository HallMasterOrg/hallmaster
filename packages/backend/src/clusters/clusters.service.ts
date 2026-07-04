import type { Readable } from 'node:stream';

import type { Cluster } from '@hallmaster/prisma-client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Observable } from 'rxjs';

import { DockerService } from '../docker/docker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { ClusterBulkActionResultDto } from './dto/cluster-bulk-action-result.dto.js';
import { GetAggregateStatsDto } from './dto/get-aggregate-stats.dto.js';
import { GetClusterStatsDto } from './dto/get-cluster-stats.dto.js';

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
    const clusters = await this.prismaService.cluster.findMany({
      select: {
        id: true,
        shardIds: true,
        status: true,
        botId: true,
        containerId: true,
      },
      orderBy: { id: 'asc' },
    });

    return await Promise.all(
      clusters.map(async (c) => ({
        id: c.id,
        shardIds: c.shardIds,
        status: await this.dockerService.reconcileClusterStatus(c),
      })),
    );
  }

  async findOne(id: number) {
    const resource = await this.prismaService.cluster.findFirst({
      select: {
        id: true,
        shardIds: true,
        status: true,
        botId: true,
        containerId: true,
      },
      where: { id },
    });

    if (null === resource) {
      throw new NotFoundException();
    }

    return {
      id: resource.id,
      shardIds: resource.shardIds,
      status: await this.dockerService.reconcileClusterStatus(resource),
    };
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

  async streamLogs(id: number, tail: number | 'all' = 0): Promise<Readable> {
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

  async streamStats(id: number): Promise<Readable> {
    const resource = await this.getFullResource(id);

    if (null === resource.containerId) {
      throw new BadRequestException('The cluster has no container ID.');
    }

    if (resource.status !== 'RUNNING') {
      throw new BadRequestException('Unable to gather stats on a non-running cluster.');
    }

    return await this.dockerService.streamContainerStats(resource.containerId);
  }

  async startAll(): Promise<ClusterBulkActionResultDto> {
    return await this.runBulkAction((id) => this.start(id));
  }

  async stopAll(): Promise<ClusterBulkActionResultDto> {
    return await this.runBulkAction((id) => this.stop(id));
  }

  async restartAll(): Promise<ClusterBulkActionResultDto> {
    return await this.runBulkAction((id) => this.restart(id));
  }

  private async runBulkAction(action: (id: number) => Promise<unknown>): Promise<ClusterBulkActionResultDto> {
    const clusters = await this.prismaService.cluster.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    const settled = await Promise.allSettled(clusters.map((c) => action(c.id)));

    const succeeded: number[] = [];
    const failed: Array<{ id: number; reason: string }> = [];

    settled.forEach((result, index) => {
      const id = clusters[index].id;
      if (result.status === 'fulfilled') {
        succeeded.push(id);
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failed.push({ id, reason });
      }
    });

    return { succeeded, failed };
  }

  async aggregateStats(): Promise<GetAggregateStatsDto> {
    const clusters = await this.prismaService.cluster.findMany({
      where: { status: 'RUNNING', containerId: { not: null } },
      select: { id: true, containerId: true },
    });

    const runnable = clusters.filter((c): c is { id: number; containerId: string } => c.containerId !== null);

    const results = await Promise.allSettled(
      runnable.map(async (c) => ({
        id: c.id,
        stats: await this.dockerService.getContainerStats(c.containerId),
      })),
    );

    const aggregate: GetAggregateStatsDto = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        aggregate[result.value.id] = result.value.stats;
      }
    }

    return aggregate;
  }

  streamAggregateStats(intervalSeconds: number): Observable<GetAggregateStatsDto> {
    return new Observable<GetAggregateStatsDto>((subscriber) => {
      const streams = new Map<number, Readable>();
      const latest = new Map<number, GetClusterStatsDto>();
      let closed = false;

      const removeStream = (id: number) => {
        streams.get(id)?.destroy();
        streams.delete(id);
        latest.delete(id);
      };

      const addStream = async (id: number, containerId: string) => {
        if (streams.has(id)) {
          return;
        }

        try {
          const stream = await this.dockerService.streamContainerStats(containerId);

          if (closed) {
            stream.destroy();
            return;
          }

          streams.set(id, stream);
          stream.on('data', (stats: GetClusterStatsDto) => latest.set(id, stats));
          stream.on('error', () => removeStream(id));
          stream.on('end', () => removeStream(id));
        } catch {
          // the next reconcile tick will retry opening this stream
        }
      };

      const reconcile = async () => {
        let clusters: Array<{ id: number; containerId: string | null }>;
        try {
          clusters = await this.prismaService.cluster.findMany({
            where: { status: 'RUNNING', containerId: { not: null } },
            select: { id: true, containerId: true },
          });
        } catch {
          return;
        }

        const running = new Map(
          clusters
            .filter((c): c is { id: number; containerId: string } => c.containerId !== null)
            .map((c) => [c.id, c.containerId] as const),
        );

        for (const id of [...streams.keys()]) {
          if (!running.has(id)) {
            removeStream(id);
          }
        }

        for (const [id, containerId] of running) {
          void addStream(id, containerId);
        }
      };

      const emit = () => {
        const snapshot: GetAggregateStatsDto = {};
        for (const [id, stats] of latest) {
          snapshot[id] = stats;
        }
        subscriber.next(snapshot);
      };

      void reconcile();
      const reconcileTimer = setInterval(() => void reconcile(), intervalSeconds * 1000);
      const emitTimer = setInterval(emit, intervalSeconds * 1000);

      return () => {
        closed = true;
        clearInterval(reconcileTimer);
        clearInterval(emitTimer);
        for (const id of [...streams.keys()]) {
          removeStream(id);
        }
      };
    });
  }
}
