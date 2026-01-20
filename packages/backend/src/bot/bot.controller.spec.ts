import { Test, TestingModule } from '@nestjs/testing';
import { BotController } from './bot.controller.js';
import { BotService } from './bot.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ClustersModule } from '../clusters/clusters.module.js';
import { ConfigModule } from '@nestjs/config';

describe('BotController', () => {
  let controller: BotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, ConfigModule, ClustersModule],
      controllers: [BotController],
      providers: [BotService],
    }).compile();

    controller = module.get<BotController>(BotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
