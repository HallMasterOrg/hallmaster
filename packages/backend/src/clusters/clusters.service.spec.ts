import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { ClustersService } from './clusters.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DockerService } from '../docker/docker.service.js';

describe('ClustersService', () => {
  let service: ClustersService;
  const prismaService: DeepMockProxy<PrismaService> = mockDeep<PrismaService>();
  const dockerService: DeepMockProxy<DockerService> = mockDeep<DockerService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClustersService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: DockerService,
          useValue: dockerService,
        },
      ],
    }).compile();

    service = module.get<ClustersService>(ClustersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
