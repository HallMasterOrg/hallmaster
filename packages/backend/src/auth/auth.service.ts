import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, argon2id, verify } from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { CreatedUserDto } from './entities/created-user.entity.js';
import { UserTokenDto } from './entities/user-token.entity.js';
import { UserTokenDataDto } from './entities/user-token-data.entity.js';

/* https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id */
const OWASP_CONFIGS = [
  { m: 47104, t: 1, p: 1 } /* DO NOT USE WITH ARGON2I */,
  { m: 19456, t: 2, p: 1 } /* DO NOT USE WITH ARGON2I */,
  { m: 12288, t: 3, p: 1 },
  { m: 9216, t: 4, p: 1 },
  { m: 7168, t: 5, p: 1 },
];

@Injectable()
export class AuthService {
  private static CONFIG = OWASP_CONFIGS[2];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private static hashPassword(password: string) {
    return hash(password, {
      type: argon2id,
      memoryCost: AuthService.CONFIG.m,
      timeCost: AuthService.CONFIG.t,
      parallelism: AuthService.CONFIG.p,
      hashLength: 32,
      salt: randomBytes(16),
    });
  }

  private static verifyPassword(hash: string, password: string) {
    return verify(hash, password);
  }

  async register(dto: RegisterDto): Promise<CreatedUserDto> {
    const users = await this.prismaService.user.count();
    if (users > 0) {
      throw new ConflictException();
    }

    const hashedPassword = await AuthService.hashPassword(dto.password);

    try {
      const { username } = await this.prismaService.user.create({
        select: {
          username: true,
        },
        data: {
          username: dto.username,
          password: hashedPassword,
        },
      });

      return {
        username: username,
      };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && 'P2002' === e.code) {
        throw new ConflictException();
      }
      throw new InternalServerErrorException();
    }
  }

  async login(dto: LoginDto): Promise<UserTokenDto> {
    const user = await this.prismaService.user.findFirst({
      select: {
        username: true,
        password: true,
      },
      where: {
        username: dto.username,
      },
    });

    if (null === user) {
      throw new UnauthorizedException();
    }

    const passwordMatch = await AuthService.verifyPassword(
      user.password,
      dto.password,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException();
    }

    const token = await this.jwtService.signAsync({
      username: user.username,
    });
    return { token };
  }

  async verifyToken(token: string): Promise<UserTokenDataDto> {
    return await this.jwtService.verifyAsync<UserTokenDataDto>(token);
  }
}
