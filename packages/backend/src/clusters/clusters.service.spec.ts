import { Test, TestingModule } from '@nestjs/testing';
import { ClustersService } from './clusters.service.js';

describe('ClustersService', () => {
  let service: ClustersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClustersService],
    }).compile();

    service = module.get<ClustersService>(ClustersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
