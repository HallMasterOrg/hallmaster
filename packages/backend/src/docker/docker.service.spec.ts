import { DockerAPIHttpError, DockerSocket, type DockerContainerStats } from '@hallmaster/docker.js';
import type { Bot, Cluster } from '@hallmaster/prisma-client';
import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';

import { PrismaService } from '../prisma/prisma.service.js';

import { DockerService } from './docker.service.js';

describe('DockerService', () => {
  let service: DockerService;
  let prismaService: DeepMockProxy<PrismaService>;
  let configService: DeepMockProxy<ConfigService>;
  let dockerSocket: DeepMockProxy<DockerSocket>;

  beforeEach(async () => {
    prismaService = mockDeep<PrismaService>();
    configService = mockDeep<ConfigService>();
    dockerSocket = mockDeep<DockerSocket>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prismaService },
        { provide: DockerSocket, useValue: dockerSocket },
      ],
    }).compile();

    service = module.get<DockerService>(DockerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('idempotent lifecycle ops when container was removed out-of-band', () => {
    const cluster: Cluster = {
      botId: 'bot-1',
      id: 0,
      containerId: 'vanished-container-id',
      shardIds: [0],
      status: 'RUNNING',
    };

    it('stop() marks the cluster STOPPED and clears containerId instead of throwing', async () => {
      dockerSocket.apiCall.mockRejectedValueOnce(new DockerAPIHttpError(404, 'no such container'));

      await expect(service.stop(cluster)).resolves.not.toThrow();

      expect(prismaService.cluster.update).toHaveBeenCalledWith({
        where: { botId_id: { botId: 'bot-1', id: 0 } },
        data: { status: 'STOPPED', containerId: null },
      });
    });

    it('remove() deletes the DB row instead of throwing', async () => {
      // First call inside stop(); second call inside remove(). Both 404.
      dockerSocket.apiCall.mockRejectedValue(new DockerAPIHttpError(404, 'no such container'));

      await expect(service.remove(cluster)).resolves.not.toThrow();

      expect(prismaService.cluster.delete).toHaveBeenCalledWith({
        where: { botId_id: { botId: 'bot-1', id: 0 } },
      });
    });
  });

  describe('start() with name collision', () => {
    const bot: Bot = {
      id: 'bot-1',
      token: 'discord-token',
      totalShards: 1,
    } as unknown as Bot;

    const cluster: Cluster = {
      botId: 'bot-1',
      id: 0,
      containerId: null,
      shardIds: [0],
      status: 'STOPPED',
    };

    it('cleans up the stale container and retries when create returns 409', async () => {
      configService.getOrThrow.mockReturnValue('ENV_NAME');
      prismaService.dockerImage.findUnique.mockResolvedValue({
        botId: 'bot-1',
        serverName: 'docker.io',
        image: 'foo/bar',
        tag: 'latest',
        username: null,
        password: null,
      });

      // Image pull succeeds
      // First create attempt fails with 409. Cleanup succeeds.
      // Second create attempt succeeds. Then start succeeds.
      dockerSocket.apiCall
        .mockResolvedValueOnce(undefined) // pull
        .mockRejectedValueOnce(new DockerAPIHttpError(409, 'name already in use')) // create #1
        .mockResolvedValueOnce(undefined) // stop the stale one
        .mockResolvedValueOnce(undefined) // remove the stale one
        .mockResolvedValueOnce({ Id: 'new-container-id' } as never) // create #2
        .mockResolvedValueOnce(undefined); // start

      await expect(service.start(bot, cluster)).resolves.toBe('new-container-id');
    });
  });

  describe('reconcileClusterStatus', () => {
    const baseCluster = { id: 0, botId: 'bot-1', containerId: 'container-id' };

    it('flips DB RUNNING→STOPPED when the container has been stopped out-of-band', async () => {
      dockerSocket.apiCall.mockResolvedValueOnce({ State: { Running: false } } as never);

      const status = await service.reconcileClusterStatus({ ...baseCluster, status: 'RUNNING' });

      expect(status).toBe('STOPPED');
      expect(prismaService.cluster.update).toHaveBeenCalledWith({
        where: { botId_id: { botId: 'bot-1', id: 0 } },
        data: { status: 'STOPPED' },
      });
    });

    it('clears containerId and marks STOPPED when the container has vanished (404)', async () => {
      dockerSocket.apiCall.mockRejectedValueOnce(new DockerAPIHttpError(404, 'no such container'));

      const status = await service.reconcileClusterStatus({ ...baseCluster, status: 'RUNNING' });

      expect(status).toBe('STOPPED');
      expect(prismaService.cluster.update).toHaveBeenCalledWith({
        where: { botId_id: { botId: 'bot-1', id: 0 } },
        data: { status: 'STOPPED', containerId: null },
      });
    });

    it('does not touch DB when the actual state matches the stored one', async () => {
      dockerSocket.apiCall.mockResolvedValueOnce({ State: { Running: true } } as never);

      const status = await service.reconcileClusterStatus({ ...baseCluster, status: 'RUNNING' });

      expect(status).toBe('RUNNING');
      expect(prismaService.cluster.update).not.toHaveBeenCalled();
    });

    it('skips transient states (STARTING/UPDATING/ERROR) without hitting Docker', async () => {
      const status = await service.reconcileClusterStatus({ ...baseCluster, status: 'STARTING' });

      expect(status).toBe('STARTING');
      expect(dockerSocket.apiCall).not.toHaveBeenCalled();
      expect(prismaService.cluster.update).not.toHaveBeenCalled();
    });

    it('returns current status without throwing when Docker is unreachable', async () => {
      dockerSocket.apiCall.mockRejectedValueOnce(new DockerAPIHttpError(500, 'socket error'));

      const status = await service.reconcileClusterStatus({ ...baseCluster, status: 'RUNNING' });

      expect(status).toBe('RUNNING');
      expect(prismaService.cluster.update).not.toHaveBeenCalled();
    });
  });

  describe('getContainerStats CPU percentage', () => {
    const buildStats = (cpuTotal: number, precpuTotal: number) =>
      ({
        cpu_stats: {
          cpu_usage: { total_usage: cpuTotal, percpu_usage: [0], usage_in_kernelmode: 0, usage_in_usermode: 0 },
          system_cpu_usage: 2_000_000,
          online_cpus: 1,
          throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 },
        },
        precpu_stats: {
          cpu_usage: { total_usage: precpuTotal, percpu_usage: [0], usage_in_kernelmode: 0, usage_in_usermode: 0 },
          system_cpu_usage: 1_000_000,
          online_cpus: 1,
          throttling_data: { periods: 0, throttled_periods: 0, throttled_time: 0 },
        },
        pids_stats: { current: 1, limit: 10 },
        memory_stats: { usage: 100, limit: 1000, stats: {} },
        blkio_stats: { io_service_bytes_recursive: [] },
        networks: {},
      }) as unknown as DockerContainerStats;

    it('clamps CPU to 0 when the delta is negative (counter reset on restart)', async () => {
      dockerSocket.apiCall.mockResolvedValueOnce(buildStats(100, 1000));

      const stats = await service.getContainerStats('container-1');

      expect(stats.cpuPercentage).toBe(0);
    });

    it('computes the CPU percentage from a positive delta', async () => {
      dockerSocket.apiCall.mockResolvedValueOnce(buildStats(1500, 1000));

      const stats = await service.getContainerStats('container-1');

      // cpuDelta 500 / systemDelta 1_000_000 * 1 online cpu * 100
      expect(stats.cpuPercentage).toBeCloseTo(0.05);
    });
  });
});
