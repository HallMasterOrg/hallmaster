import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { DockerSocket } from '@hallmaster/docker.js';
import { DockerService } from './docker.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
        {
          provide: String,
          useValue: JSON.stringify({
            identitytoken: Buffer.from(
              JSON.stringify({
                username: 'bob',
                password: 'password',
                serveraddress: '127.0.0.1',
              }),
            ).toString('base64'),
          }),
        },
      ],
    }).compile();

    service = module.get<DockerService>(DockerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
