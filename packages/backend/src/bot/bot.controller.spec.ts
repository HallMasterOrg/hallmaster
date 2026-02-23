import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { BotController } from './bot.controller.js';
import { BotService } from './bot.service.js';
import { AuthGuard } from '../auth/guards/jwt.guard.js';

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
