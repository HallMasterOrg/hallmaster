import { sign } from "hono/jwt";

import { ForbiddenException } from "#exceptions/http-exceptions";
import env from "#lib/env";
import type { User } from "#prisma/client";
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

  private static async register(user: User) {
    const userCount = await UserRepository.count();
    if (userCount !== 0)
      throw new ForbiddenException({ message: "This Discord account cannot access this instance" });

    return await UserRepository.create(user);
  }

  public static authorizationUrl({
    redirectUri,
    state,
  }: DiscordAuthorization): DiscordAuthorizationUrl {
    return { url: DiscordService.authorizationUrl(redirectUri, state) };
  }

  public static async login({ code, redirectUri }: DiscordLogin): Promise<UserTokenResponse> {
    const accessToken = await DiscordService.getAccessToken(code, redirectUri);
    const { id, username } = await DiscordService.getUser(accessToken);

    const user = (await UserRepository.findById(id)) ?? (await this.register({ id, username }));

    return { token: await this.sign(user.id) };
  }
}
