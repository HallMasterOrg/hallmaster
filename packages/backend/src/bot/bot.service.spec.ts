import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { BotService } from './bot.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClustersService } from '../clusters/clusters.service.js';
import { CreateBotDto, UpdateBotDto } from 'src/index.dto.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

const HALLMASTER_BOT_ID = '1352006130926096504';
const DISCORD_BOT_TOKEN = `${Buffer.from(HALLMASTER_BOT_ID).toString('base64')}.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ`;

const MOCK_DOCKER_IMAGE = {
  serverName: 'host.docker.internal:5000',
  image: 'hallmaster/discord-bot',
  tag: 'latest',
  username: null,
};

const EXPECTED_DOCKER_IMAGE = {
  image: 'host.docker.internal:5000/hallmaster/discord-bot:latest',
  username: null,
};

describe('BotService', () => {
  let service: BotService;

  const prismaService: DeepMockProxy<PrismaService> = mockDeep<PrismaService>();
  const clustersService: DeepMockProxy<ClustersService> =
    mockDeep<ClustersService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: PrismaService, useValue: prismaService },
        { provide: ClustersService, useValue: clustersService },
      ],
    }).compile();

    service = module.get<BotService>(BotService);
  });

  it('should create the bot without layout', async () => {
    const body: CreateBotDto = {
      token: DISCORD_BOT_TOKEN,
      dockerImage: {
        image: 'host.docker.internal:5000/hallmaster/discord-bot:latest',
        username: null,
        password: null,
      },
    };

    (prismaService.bot.create as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 0,
      clusters: [],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    const result = await service.create(body);

    expect(result).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 0,
      layout: [],
      dockerImage: EXPECTED_DOCKER_IMAGE,
    });
  });

  it('should throw ConflictException when bot already exists', async () => {
    const body: CreateBotDto = {
      token: DISCORD_BOT_TOKEN,
      dockerImage: {
        image: 'host.docker.internal:5000/hallmaster/discord-bot:latest',
        username: null,
        password: null,
      },
    };

    prismaService.bot.create.mockRejectedValueOnce(
      new PrismaClientKnownRequestError('Conflict', {
        code: 'P2002',
        clientVersion: '',
      }),
    );

    await expect(service.create(body)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('should find the bot', async () => {
    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 6,
      clusters: [
        { id: '1', status: 'RUNNING', shardIds: [0, 1, 2] },
        { id: '2', status: 'RUNNING', shardIds: [3, 4, 5] },
      ],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    const data = await service.findOne();

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 6,
      layout: [
        [0, 1, 2],
        [3, 4, 5],
      ],
      dockerImage: EXPECTED_DOCKER_IMAGE,
    });
  });

  it('should find the bot without layout', async () => {
    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 0,
      clusters: [],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    const data = await service.findOne();

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 0,
      layout: [],
      dockerImage: EXPECTED_DOCKER_IMAGE,
    });
  });

  it('should throw NotFoundException when no bot exists', async () => {
    prismaService.bot.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should update the bot layout (grow shards)', async () => {
    const body: UpdateBotDto = {
      layout: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]],
    };

    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 7,
      clusters: [
        { id: '1', status: 'RUNNING', shardIds: [0, 1, 2] },
        { id: '2', status: 'RUNNING', shardIds: [3, 4, 5] },
        { id: '3', status: 'RUNNING', shardIds: [6] },
      ],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    clustersService.remove.mockResolvedValue();

    (prismaService.bot.update as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 10,
      clusters: [
        { id: '1', status: 'UPDATING', shardIds: [0, 1, 2] },
        { id: '2', status: 'UPDATING', shardIds: [3, 4, 5] },
        { id: '3', status: 'UPDATING', shardIds: [6, 7, 8] },
        { id: '4', status: 'UPDATING', shardIds: [9] },
      ],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    clustersService.start.mockResolvedValue();

    const data = await service.update(body);

    expect(clustersService.remove).toHaveBeenCalledWith('1');
    expect(clustersService.remove).toHaveBeenCalledWith('2');
    expect(clustersService.remove).toHaveBeenCalledWith('3');
    expect(clustersService.remove).toHaveBeenCalledTimes(3);

    expect(clustersService.start).toHaveBeenCalledWith('1');
    expect(clustersService.start).toHaveBeenCalledWith('2');
    expect(clustersService.start).toHaveBeenCalledWith('3');
    expect(clustersService.start).toHaveBeenCalledWith('4');
    expect(clustersService.start).toHaveBeenCalledTimes(4);

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 10,
      layout: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]],
      dockerImage: EXPECTED_DOCKER_IMAGE,
    });
  });

  it('should set initial layout via update', async () => {
    const body: UpdateBotDto = {
      layout: [[0, 1, 2], [3, 4, 5], [6]],
    };

    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 0,
      clusters: [],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    (prismaService.bot.update as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 7,
      clusters: [
        { id: '1', status: 'UPDATING', shardIds: [0, 1, 2] },
        { id: '2', status: 'UPDATING', shardIds: [3, 4, 5] },
        { id: '3', status: 'UPDATING', shardIds: [6] },
      ],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    clustersService.start.mockResolvedValue();

    const data = await service.update(body);

    expect(clustersService.remove).not.toHaveBeenCalled();

    expect(clustersService.start).toHaveBeenCalledWith('1');
    expect(clustersService.start).toHaveBeenCalledWith('2');
    expect(clustersService.start).toHaveBeenCalledWith('3');
    expect(clustersService.start).toHaveBeenCalledTimes(3);

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 7,
      layout: [[0, 1, 2], [3, 4, 5], [6]],
      dockerImage: EXPECTED_DOCKER_IMAGE,
    });
  });

  it('should update the bot layout only (same shards)', async () => {
    const body: UpdateBotDto = {
      layout: [
        [0, 1, 2, 3, 4],
        [5, 6],
      ],
    };

    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 7,
      clusters: [
        { id: '1', status: 'STOPPED', shardIds: [0, 1, 2] },
        { id: '2', status: 'RUNNING', shardIds: [3, 4, 5] },
        { id: '3', status: 'RUNNING', shardIds: [6] },
      ],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    clustersService.remove.mockResolvedValue();

    (prismaService.bot.update as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 7,
      clusters: [
        { id: '1', status: 'UPDATING', shardIds: [0, 1, 2, 3, 4] },
        { id: '2', status: 'UPDATING', shardIds: [5, 6] },
      ],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    clustersService.start.mockResolvedValue();

    const data = await service.update(body);

    expect(clustersService.remove).toHaveBeenCalledTimes(3);

    expect(clustersService.start).toHaveBeenCalledWith('1');
    expect(clustersService.start).toHaveBeenCalledWith('2');
    expect(clustersService.start).toHaveBeenCalledTimes(2);

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 7,
      layout: [
        [0, 1, 2, 3, 4],
        [5, 6],
      ],
      dockerImage: EXPECTED_DOCKER_IMAGE,
    });
  });

  it('should reject layout with duplicate shard IDs', async () => {
    const body: UpdateBotDto = {
      layout: [
        [0, 1],
        [1, 2],
      ],
    };

    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 0,
      clusters: [],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    await expect(service.update(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should reject layout with out-of-range shard IDs', async () => {
    const body: UpdateBotDto = {
      layout: [[0, 5]],
    };

    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 0,
      clusters: [],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    await expect(service.update(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw NotFoundException when updating non-existent bot', async () => {
    const body: UpdateBotDto = {
      layout: [
        [0, 1, 2],
        [3, 4],
      ],
    };

    prismaService.bot.findFirst.mockResolvedValueOnce(null);

    await expect(service.update(body)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should remove the bot and stop all clusters', async () => {
    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 5,
      clusters: [
        { id: '1', status: 'STOPPED', shardIds: [0, 1, 2] },
        { id: '2', status: 'RUNNING', shardIds: [3, 4] },
      ],
      dockerImage: MOCK_DOCKER_IMAGE,
    });

    prismaService.bot.delete.mockResolvedValueOnce({} as never);
    clustersService.stopByCluster.mockResolvedValue();

    const data = await service.remove();

    expect(clustersService.stopByCluster).toHaveBeenCalledTimes(2);

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 5,
      layout: [
        [0, 1, 2],
        [3, 4],
      ],
      dockerImage: EXPECTED_DOCKER_IMAGE,
    });
  });

  it('should throw NotFoundException when removing non-existent bot', async () => {
    prismaService.bot.findFirst.mockResolvedValueOnce(null);

    await expect(service.remove()).rejects.toBeInstanceOf(NotFoundException);
  });
});
