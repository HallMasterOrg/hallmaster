import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';

import { AuthGuard } from '../auth/guards/jwt.guard.js';

import { BotController } from './bot.controller.js';
import { BotService } from './bot.service.js';

describe('BotController', () => {
  let controller: BotController;
  const authGuard: DeepMockProxy<AuthGuard> = mockDeep<AuthGuard>();
  const botService: DeepMockProxy<BotService> = mockDeep<BotService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotController],
      providers: [
        {
          provide: BotService,
          useValue: botService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .compile();

    controller = module.get<BotController>(BotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
