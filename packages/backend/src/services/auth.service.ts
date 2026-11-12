import { sign } from "hono/jwt";

import { ForbiddenException } from "#exceptions/http-exceptions";
import env from "#lib/env";
import type { Prisma } from "#prisma/client";
import UserRepository from "#repositories/user.repository";
import type {
  DiscordAuthorization,
  DiscordAuthorizationUrl,
  DiscordLogin,
  UserTokenResponse,
} from "#schemas/auth.schema";

import DiscordService from "./discord.service";

export class AuthService {
  private static async sign(sub: string) {
    return await sign(
      {
        sub,
        exp: Math.floor(Date.now() / 1000) + 3600 * 12,
      },
      env.SECRET,
    );
  }

  private static async register(user: Prisma.UserCreateInput) {
    const owner =
      (await UserRepository.count()) === 0 ? await UserRepository.createOwner(user) : null;
    if (owner === null)
      throw new ForbiddenException({ message: "This Discord account cannot access this instance" });

    return owner;
  }

  public static authorizationUrl({
    redirectUri,
    state,
  }: DiscordAuthorization): DiscordAuthorizationUrl {
    return { url: DiscordService.authorizationUrl(redirectUri, state) };
  }

  public static async login({ code, redirectUri }: DiscordLogin): Promise<UserTokenResponse> {
    const accessToken = await DiscordService.getAccessToken(code, redirectUri);
    const { id, username, global_name, avatar } = await DiscordService.getUser(accessToken);
    const profile = { id, username, displayName: global_name, avatar };

    const user =
      (await UserRepository.findById(id)) === null
        ? await this.register(profile)
        : await UserRepository.update(profile);

    return { token: await this.sign(user.id) };
  }
}
