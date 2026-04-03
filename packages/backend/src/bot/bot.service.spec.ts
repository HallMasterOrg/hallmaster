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
import { Prisma } from '@hallmaster/prisma-client';

const HALLMASTER_BOT_ID = '1352006130926096504';
const DISCORD_BOT_TOKEN = `${Buffer.from(HALLMASTER_BOT_ID).toString('base64')}.YYYYYY.ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ`;

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create the bot', async () => {
    const body: CreateBotDto = {
      layout: [[0]],
      token: DISCORD_BOT_TOKEN,
      dockerImage: {
        image: 'host.docker.internal:5000/hallmaster/discord-bot:latest',
        username: null,
        password: null,
      },
    };

    (prismaService.bot.create as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 1,
      clusters: [
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'STOPPED',
          shardIds: [0],
        },
      ],
    } satisfies Prisma.BotGetPayload<{
      select: { id: true; totalShards: true; clusters: true };
    }>);

    const result = await service.create(body);

    const [serverName, ...path] = body.dockerImage.image.split('/');
    const [image, tag] = path.join('/').split(':');
    expect(prismaService.bot.create).toHaveBeenCalledWith({
      data: {
        id: HALLMASTER_BOT_ID,
        token: body.token,
        dockerImage: {
          create: {
            image: image,
            serverName: serverName,
            username: body.dockerImage.username,
            password: body.dockerImage.password,
            tag: tag,
          },
        },
        totalShards: 1,
        clusters: {
          createMany: {
            data: [{ status: 'STOPPED', shardIds: [0] }],
          },
        },
      },
      select: {
        id: true,
        clusters: true,
        totalShards: true,
      },
    });
    expect(prismaService.bot.create).toHaveBeenCalledTimes(1);

    expect(result).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 1,
      layout: [[0]],
    });
  });

  it('should create the bot with custom layout', async () => {
    const body: CreateBotDto = {
      layout: [[0, 1, 2], [3, 4, 5], [6]],
      token: DISCORD_BOT_TOKEN,
      dockerImage: {
        image: 'host.docker.internal:5000/hallmaster/discord-bot:latest',
        username: null,
        password: null,
      },
    };

    (prismaService.bot.create as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 7,
      clusters: [
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'STOPPED',
          shardIds: [0, 1, 2],
        },
        {
          id: '2',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-2`,
          status: 'STOPPED',
          shardIds: [3, 4, 5],
        },
        {
          id: '3',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-3`,
          status: 'STOPPED',
          shardIds: [6],
        },
      ],
    });

    const result = await service.create(body);

    expect(prismaService.bot.create).toHaveBeenCalledWith({
      data: {
        id: HALLMASTER_BOT_ID,
        token: DISCORD_BOT_TOKEN,
        dockerImage: {
          create: {
            image: 'hallmaster/discord-bot',
            serverName: 'host.docker.internal:5000',
            username: null,
            password: null,
            tag: 'latest',
          },
        },
        totalShards: 7,
        clusters: {
          createMany: {
            data: [
              { status: 'STOPPED', shardIds: [0, 1, 2] },
              { status: 'STOPPED', shardIds: [3, 4, 5] },
              { status: 'STOPPED', shardIds: [6] },
            ],
          },
        },
      },
      select: {
        id: true,
        totalShards: true,
        clusters: true,
      },
    });
    expect(prismaService.bot.create).toHaveBeenCalledTimes(1);

    expect(result).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 7,
      layout: [[0, 1, 2], [3, 4, 5], [6]],
    });
  });

  it('should reject layout with duplicate shard IDs', async () => {
    const body: CreateBotDto = {
      layout: [
        [0, 1],
        [1, 2],
      ],
      token: DISCORD_BOT_TOKEN,
      dockerImage: {
        image: 'host.docker.internal:5000/hallmaster/discord-bot:latest',
        username: null,
        password: null,
      },
    };

    await expect(service.create(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should reject layout with out-of-range shard IDs', async () => {
    const body: CreateBotDto = {
      layout: [[0, 5]],
      token: DISCORD_BOT_TOKEN,
      dockerImage: {
        image: 'host.docker.internal:5000/hallmaster/discord-bot:latest',
        username: null,
        password: null,
      },
    };

    await expect(service.create(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should not create the bot', async () => {
    const body: CreateBotDto = {
      layout: [[0]],
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

    const [serverName, ...path] = body.dockerImage.image.split('/');
    const [image, tag] = path.join('/').split(':');
    expect(prismaService.bot.create).toHaveBeenCalledWith({
      data: {
        id: HALLMASTER_BOT_ID,
        token: body.token,
        totalShards: 1,
        dockerImage: {
          create: {
            image: image,
            serverName: serverName,
            username: body.dockerImage.username,
            password: body.dockerImage.password,
            tag: tag,
          },
        },
        clusters: {
          createMany: {
            data: [{ status: 'STOPPED', shardIds: [0] }],
          },
        },
      },
      select: {
        id: true,
        clusters: true,
        totalShards: true,
      },
    });
    expect(prismaService.bot.create).toHaveBeenCalledTimes(1);
  });

  it('should find the bot', async () => {
    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 6,
      clusters: [
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'RUNNING',
          shardIds: [0, 1, 2],
        },
        {
          id: '2',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-2`,
          status: 'RUNNING',
          shardIds: [3, 4, 5],
        },
      ],
    } satisfies Prisma.BotGetPayload<{
      select: { id: true; totalShards: true; clusters: true };
    }>);

    const data = await service.findOne();

    expect(prismaService.bot.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        totalShards: true,
        clusters: true,
      },
    });
    expect(prismaService.bot.findFirst).toHaveBeenCalledTimes(1);

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 6,
      layout: [
        [0, 1, 2],
        [3, 4, 5],
      ],
    });
  });

  it('should not find the bot', async () => {
    prismaService.bot.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne()).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaService.bot.findFirst).toHaveBeenCalledWith({
      select: {
        id: true,
        totalShards: true,
        clusters: true,
      },
    });
    expect(prismaService.bot.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should update the bot layout (grow shards)', async () => {
    const body: UpdateBotDto = {
      layout: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]],
    };

    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 7,
      clusters: [
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'RUNNING',
          shardIds: [0, 1, 2],
        },
        {
          id: '2',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-2`,
          status: 'RUNNING',
          shardIds: [3, 4, 5],
        },
        {
          id: '3',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-3`,
          status: 'RUNNING',
          shardIds: [6],
        },
      ],
    } satisfies Prisma.BotGetPayload<{
      select: { id: true; totalShards: true; clusters: true };
    }>);

    clustersService.remove.mockResolvedValue();

    (prismaService.bot.update as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 10,
      clusters: [
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'UPDATING',
          shardIds: [0, 1, 2],
        },
        {
          id: '2',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-2`,
          status: 'UPDATING',
          shardIds: [3, 4, 5],
        },
        {
          id: '3',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-3`,
          status: 'UPDATING',
          shardIds: [6, 7, 8],
        },
        {
          id: '4',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-4`,
          status: 'UPDATING',
          shardIds: [9],
        },
      ],
    } satisfies Prisma.BotGetPayload<{
      select: { id: true; totalShards: true; clusters: true };
    }>);

    clustersService.start.mockResolvedValue();

    const data = await service.update(body);

    expect(prismaService.bot.findFirst).toHaveBeenCalledWith({
      select: { clusters: true, id: true, totalShards: true },
    });
    expect(prismaService.bot.findFirst).toHaveBeenCalledTimes(1);

    expect(clustersService.remove).toHaveBeenCalledWith('1');
    expect(clustersService.remove).toHaveBeenCalledWith('2');
    expect(clustersService.remove).toHaveBeenCalledWith('3');
    expect(clustersService.remove).toHaveBeenCalledTimes(3);

    expect(prismaService.bot.update).toHaveBeenCalledWith({
      data: {
        totalShards: 10,
        clusters: {
          createMany: {
            data: [
              { status: 'UPDATING', shardIds: [0, 1, 2] },
              { status: 'UPDATING', shardIds: [3, 4, 5] },
              { status: 'UPDATING', shardIds: [6, 7, 8] },
              { status: 'UPDATING', shardIds: [9] },
            ],
          },
        },
      },
      where: { id: HALLMASTER_BOT_ID },
      select: { id: true, totalShards: true, clusters: true },
    });
    expect(prismaService.bot.update).toHaveBeenCalledTimes(1);

    expect(clustersService.start).toHaveBeenCalledWith('1');
    expect(clustersService.start).toHaveBeenCalledWith('2');
    expect(clustersService.start).toHaveBeenCalledWith('3');
    expect(clustersService.start).toHaveBeenCalledWith('4');
    expect(clustersService.start).toHaveBeenCalledTimes(4);

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 10,
      layout: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]],
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
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'STOPPED',
          shardIds: [0, 1, 2],
        },
        {
          id: '2',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-2`,
          status: 'RUNNING',
          shardIds: [3, 4, 5],
        },
        {
          id: '3',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-3`,
          status: 'RUNNING',
          shardIds: [6],
        },
      ],
    } satisfies Partial<
      Prisma.BotGetPayload<{
        select: { id: true; totalShards: true; clusters: true };
      }>
    >);

    clustersService.remove.mockResolvedValue();

    (prismaService.bot.update as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 7,
      clusters: [
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'UPDATING',
          shardIds: [0, 1, 2, 3, 4],
        },
        {
          id: '2',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-2`,
          status: 'UPDATING',
          shardIds: [5, 6],
        },
      ],
    } satisfies Prisma.BotGetPayload<{
      select: { id: true; totalShards: true; clusters: true };
    }>);

    clustersService.start.mockResolvedValue();

    const data = await service.update(body);

    expect(prismaService.bot.findFirst).toHaveBeenCalledWith({
      select: { clusters: true, id: true, totalShards: true },
    });
    expect(prismaService.bot.findFirst).toHaveBeenCalledTimes(1);

    expect(clustersService.remove).toHaveBeenCalledWith('1');
    expect(clustersService.remove).toHaveBeenCalledWith('2');
    expect(clustersService.remove).toHaveBeenCalledWith('3');
    expect(clustersService.remove).toHaveBeenCalledTimes(3);

    expect(prismaService.bot.update).toHaveBeenCalledWith({
      data: {
        totalShards: 7,
        clusters: {
          createMany: {
            data: [
              { status: 'UPDATING', shardIds: [0, 1, 2, 3, 4] },
              { status: 'UPDATING', shardIds: [5, 6] },
            ],
          },
        },
      },
      where: { id: HALLMASTER_BOT_ID },
      select: { id: true, totalShards: true, clusters: true },
    });
    expect(prismaService.bot.update).toHaveBeenCalledTimes(1);

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
    });
  });

  it('should not update the bot', async () => {
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

    expect(prismaService.bot.findFirst).toHaveBeenCalledWith({
      select: { clusters: true, id: true, totalShards: true },
    });
    expect(prismaService.bot.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should remove the bot', async () => {
    (prismaService.bot.findFirst as jest.Mock).mockResolvedValueOnce({
      id: HALLMASTER_BOT_ID,
      totalShards: 5,
      clusters: [
        {
          id: '1',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-1`,
          status: 'STOPPED',
          shardIds: [0, 1, 2],
        },
        {
          id: '2',
          botId: HALLMASTER_BOT_ID,
          containerId: `${HALLMASTER_BOT_ID}-2`,
          status: 'RUNNING',
          shardIds: [3, 4],
        },
      ],
    } satisfies Prisma.BotGetPayload<{
      select: { id: true; totalShards: true; clusters: true };
    }>);

    prismaService.bot.delete.mockResolvedValueOnce(
      {} as Prisma.BotGetPayload<object>,
    );

    clustersService.stopByCluster.mockResolvedValue();

    const data = await service.remove();

    expect(prismaService.bot.delete).toHaveBeenCalledWith({
      where: {
        id: HALLMASTER_BOT_ID,
      },
    });
    expect(prismaService.bot.delete).toHaveBeenCalledTimes(1);

    expect(clustersService.stopByCluster).toHaveBeenCalledWith({
      id: '1',
      botId: HALLMASTER_BOT_ID,
      containerId: `${HALLMASTER_BOT_ID}-1`,
      status: 'STOPPED',
      shardIds: [0, 1, 2],
    });
    expect(clustersService.stopByCluster).toHaveBeenCalledWith({
      id: '2',
      botId: HALLMASTER_BOT_ID,
      containerId: `${HALLMASTER_BOT_ID}-2`,
      status: 'RUNNING',
      shardIds: [3, 4],
    });
    expect(clustersService.stopByCluster).toHaveBeenCalledTimes(2);

    expect(data).toStrictEqual({
      id: HALLMASTER_BOT_ID,
      shards: 5,
      layout: [
        [0, 1, 2],
        [3, 4],
      ],
    });
  });

  it('should not remove the bot', async () => {
    prismaService.bot.findFirst.mockResolvedValueOnce(null);

    await expect(service.remove()).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaService.bot.findFirst).toHaveBeenCalledWith({
      select: { id: true, totalShards: true, clusters: true },
    });
    expect(prismaService.bot.findFirst).toHaveBeenCalledTimes(1);
  });
});
