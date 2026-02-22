import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { BotService } from './bot.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClustersService } from '../clusters/clusters.service.js';

describe('BotService', () => {
  let service: BotService;

  const prismaService: DeepMockProxy<PrismaService> = mockDeep<PrismaService>();
  const configService: DeepMockProxy<ConfigService> = mockDeep<ConfigService>();
  const clustersService: DeepMockProxy<ClustersService> =
    mockDeep<ClustersService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: PrismaService, useValue: prismaService },
        { provide: ConfigService, useValue: configService },
        { provide: ClustersService, useValue: clustersService },
      ],
    }).compile();

    service = module.get<BotService>(BotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
