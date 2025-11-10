import { Test, TestingModule } from '@nestjs/testing';
import { ClustersController } from './clusters.controller.js';
import { ClustersService } from './clusters.service.js';

describe('ClustersController', () => {
  let controller: ClustersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClustersController],
      providers: [ClustersService],
    }).compile();

    controller = module.get<ClustersController>(ClustersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
