import { DockerAPIHttpError, DockerSocket } from '@hallmaster/docker.js';
import type { Cluster } from '@hallmaster/prisma-client';
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
});
