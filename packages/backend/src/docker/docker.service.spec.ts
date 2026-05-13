import { DockerSocket } from '@hallmaster/docker.js';
import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';

import { PrismaService } from '../prisma/prisma.service.js';

import { DockerService } from './docker.service.js';

describe('DockerService', () => {
  let service: DockerService;
  const prismaService: DeepMockProxy<PrismaService> = mockDeep<PrismaService>();
  const configService: DeepMockProxy<ConfigService> = mockDeep<ConfigService>();
  const dockerSocket: DeepMockProxy<DockerSocket> = mockDeep<DockerSocket>();

  beforeEach(async () => {
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
});
