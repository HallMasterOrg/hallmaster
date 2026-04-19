import type { Prisma } from '@hallmaster/prisma-client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';

import { PrismaService } from '../prisma/prisma.service.js';

import { AuthService } from './auth.service.js';
import type { RegisterDto } from './dto/register.dto.js';

describe('authService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  const prismaService: DeepMockProxy<PrismaService> = mockDeep<PrismaService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'secret',
          signOptions: {
            expiresIn: '1m',
          },
        }),
      ],
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user', async () => {
    const credentials: RegisterDto = {
      username: 'bob',
      password: 'ilikealice',
    };

    prismaService.user.count.mockResolvedValueOnce(0);

    prismaService.user.create.mockResolvedValueOnce({
      username: credentials.username,
    } as Prisma.UserGetPayload<object>);

    const hashPasswordMock = jest
      .spyOn(AuthService, 'hashPassword')
      .mockImplementationOnce((password) => Promise.resolve(`${password}-hashed`));

    const signAsyncMock = jest.spyOn(jwtService, 'signAsync');

    const { token } = await service.register(credentials);

    expect(prismaService.user.count).toHaveBeenCalledTimes(1);

    expect(hashPasswordMock).toHaveBeenCalledWith(credentials.password);
    expect(hashPasswordMock).toHaveBeenCalledTimes(1);

    expect(prismaService.user.create).toHaveBeenCalledWith({
      select: {
        username: true,
      },
      data: {
        username: credentials.username,
        password: `${credentials.password}-hashed`,
      },
    });
    expect(prismaService.user.create).toHaveBeenCalledTimes(1);

    expect(signAsyncMock).toHaveBeenCalledWith({
      username: credentials.username,
    });
    expect(signAsyncMock).toHaveBeenCalledTimes(1);

    const verifyAsyncMock = jest.spyOn(jwtService, 'verifyAsync');

    const data = await service.verifyToken(token);

    expect(verifyAsyncMock).toHaveBeenCalledWith(token);
    expect(verifyAsyncMock).toHaveBeenCalledTimes(1);

    expect(data.username).toStrictEqual(credentials.username);
  });

  it('should not create a user', async () => {
    const credentials: RegisterDto = {
      username: 'bob',
      password: 'ilikealice',
    };

    prismaService.user.count.mockResolvedValueOnce(1);

    await expect(service.register(credentials)).rejects.toBeInstanceOf(ConflictException);

    expect(prismaService.user.count).toHaveBeenCalledTimes(1);
  });

  it('should sign in a user', async () => {
    const credentials: RegisterDto = {
      username: 'bob',
      password: 'ilikealice',
    };

    prismaService.user.findFirst.mockResolvedValueOnce({
      username: credentials.username,
      password: `${credentials.password}-hashed`,
    } as Prisma.UserGetPayload<object>);

    const verifyPasswordMock = jest
      .spyOn(AuthService, 'verifyPassword')
      .mockImplementationOnce((hash: string, password: string) => Promise.resolve(hash === `${password}-hashed`));

    const signAsyncMock = jest.spyOn(jwtService, 'signAsync');

    const { token } = await service.login(credentials);

    expect(prismaService.user.findFirst).toHaveBeenCalledWith({
      select: {
        username: true,
        password: true,
      },
      where: {
        username: credentials.username,
      },
    });
    expect(prismaService.user.findFirst).toHaveBeenCalledTimes(1);

    expect(verifyPasswordMock).toHaveBeenCalledWith(`${credentials.password}-hashed`, credentials.password);
    expect(verifyPasswordMock).toHaveBeenCalledTimes(1);

    expect(signAsyncMock).toHaveBeenCalledWith({
      username: credentials.username,
    });
    expect(signAsyncMock).toHaveBeenCalledTimes(1);

    const verifyAsyncMock = jest.spyOn(jwtService, 'verifyAsync');

    const data = await service.verifyToken(token);

    expect(verifyAsyncMock).toHaveBeenCalledWith(token);
    expect(verifyAsyncMock).toHaveBeenCalledTimes(1);

    expect(data.username).toStrictEqual(credentials.username);
  });

  it('should sign in a user (user not found)', async () => {
    const credentials: RegisterDto = {
      username: 'bob',
      password: 'ilikealice',
    };

    prismaService.user.findFirst.mockResolvedValueOnce(null);

    await expect(service.login(credentials)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prismaService.user.findFirst).toHaveBeenCalledWith({
      select: {
        username: true,
        password: true,
      },
      where: {
        username: credentials.username,
      },
    });
    expect(prismaService.user.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should sign in a user (passwords do not match)', async () => {
    const credentials: RegisterDto = {
      username: 'bob',
      password: 'ilikealice',
    };

    prismaService.user.findFirst.mockResolvedValueOnce({
      username: credentials.username,
      password: `not-${credentials.password}-hashed`,
    } as Prisma.UserGetPayload<object>);

    const verifyPasswordMock = jest
      .spyOn(AuthService, 'verifyPassword')
      .mockImplementationOnce((hash: string, password: string) => Promise.resolve(hash === `${password}-hashed`));

    await expect(service.login(credentials)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prismaService.user.findFirst).toHaveBeenCalledWith({
      select: {
        username: true,
        password: true,
      },
      where: {
        username: credentials.username,
      },
    });
    expect(prismaService.user.findFirst).toHaveBeenCalledTimes(1);

    expect(verifyPasswordMock).toHaveBeenCalledWith(`not-${credentials.password}-hashed`, credentials.password);
    expect(verifyPasswordMock).toHaveBeenCalledTimes(1);
  });
});
