import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service.js';

const fakeEnv: Record<string, string> = {
  DATASOURCE_URL: 'postgres://username:password@localhost:5432/dbname',
};

const mockedConfigService = {
  getOrThrow(key: string) {
    const value = fakeEnv[key];
    if (undefined === value)
      throw new Error(`${key} not found in environment variables.`);
    return value;
  },
};

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: mockedConfigService },
        {
          provide: PrismaService,
          inject: [ConfigService],
          useFactory(configService: ConfigService) {
            return new PrismaService(
              configService.getOrThrow('DATASOURCE_URL'),
            );
          },
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
