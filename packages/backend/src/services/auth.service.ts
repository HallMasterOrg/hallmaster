import prisma from "#lib/database.js";
import type { User, UserTokenResponse } from "#schemas/auth.schema.js";
import { hash, verify } from "argon2";
import { sign } from "hono/jwt";
import { ConflictException, UnauthorizedException } from "../exceptions/http-exceptions.js";
import env from "../lib/env.js";
import UserRepository from "../repositories/user.repository.js";

export class AuthService {
  public static async register({ username, password }: User): Promise<UserTokenResponse> {
    const userCount = await prisma.user.count();
    if (userCount !== 0) throw new ConflictException({ message: "A user is already registered" });

    const user = await UserRepository.create({ username, passwordHash: await hash(password) });

    return { token: await sign({ sub: user.username }, env.SECRET) };
  }

  public static async login({ username, password }: User): Promise<UserTokenResponse> {
    const user = await UserRepository.findFirstByUsername(username);

    if (user === null || !(await verify(user.passwordHash, password)))
      throw new UnauthorizedException({ message: "Invalid username or password" });

    return {
      token: await sign({ sub: user.username }, env.SECRET),
    };
  }
}
