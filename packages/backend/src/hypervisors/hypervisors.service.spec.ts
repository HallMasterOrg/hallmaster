import { Test, TestingModule } from '@nestjs/testing';
import { DockerHypervisorService } from './docker-hypervisor.service.js';

describe('HypervisorsService', () => {
  let service: DockerHypervisorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DockerHypervisorService],
    }).compile();

    service = module.get<DockerHypervisorService>(DockerHypervisorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
