import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { ClustersController } from './clusters.controller.js';
import { ClustersService } from './clusters.service.js';
import { AuthGuard } from '../auth/guards/jwt.guard.js';

describe('ClustersController', () => {
  let controller: ClustersController;
  const authGuard: DeepMockProxy<AuthGuard> = mockDeep<AuthGuard>();
  const clusterService: DeepMockProxy<ClustersService> =
    mockDeep<ClustersService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClustersController],
      providers: [
        {
          provide: ClustersService,
          useValue: clusterService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .compile();

    controller = module.get<ClustersController>(ClustersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
