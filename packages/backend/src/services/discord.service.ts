import type { HTTPException } from "hono/http-exception";
import type z from "zod";

import {
  BadRequestException,
  FailedDependancyException,
  UnauthorizedException,
} from "#exceptions/http-exceptions";
import env from "#lib/env";
import type { BotDiscordProfile } from "#schemas/bot.schema";
import {
  DiscordAccessTokenSchema,
  DiscordGatewayBotSchema,
  DiscordUserSchema,
  type DiscordGatewayBot,
  type DiscordUser,
} from "#schemas/discord.schema";

type DiscordRequestInit = RequestInit & {
  errors?: Partial<Record<number, HTTPException>>;
};

export default class DiscordService {
  private static readonly DISCORD_API_BASE_URL = `${env.DISCORD_URL}/api/v10`;
  private static readonly DISCORD_CDN_BASE_URL = "https://cdn.discordapp.com";

  private static async request<S extends z.ZodType>(
    path: `/${string}`,
    schema: S,
    { errors = {}, ...init }: DiscordRequestInit,
  ): Promise<z.infer<S>> {
    const response = await fetch(`${DiscordService.DISCORD_API_BASE_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {
      throw new FailedDependancyException({ message: "Discord API is unreachable or timed out" });
    });

    const error = errors[response.status];
    if (error !== undefined) throw error;

    if (!response.ok) {
      throw new FailedDependancyException({
        message: `Discord API returned a ${response.status} ${response.statusText}`,
      });
    }

    try {
      return schema.parse(await response.json());
    } catch (error) {
      throw new FailedDependancyException({
        message: "Discord API returned an unexpected response body",
        cause: error,
      });
    }
  }

  private static async botRequest<S extends z.ZodType>(
    path: `/${string}`,
    token: string,
    schema: S,
    errors: DiscordRequestInit["errors"] = {},
  ): Promise<z.infer<S>> {
    return await this.request(path, schema, {
      headers: { Authorization: `Bot ${token}` },
      errors: {
        401: new FailedDependancyException({ message: "Invalid Discord bot token" }),
        ...errors,
      },
    });
  }

  private static cdnUrl(kind: "avatars" | "banners", id: string, hash: string | null) {
    if (hash === null) return null;

    const extension = hash.startsWith("a_") ? "gif" : "png";

    return `${this.DISCORD_CDN_BASE_URL}/${kind}/${id}/${hash}.${extension}`;
  }

  public static avatarUrl(id: string, hash: string | null) {
    return this.cdnUrl("avatars", id, hash);
  }

  public static async getGatewayBot(token: string): Promise<DiscordGatewayBot> {
    return await this.botRequest("/gateway/bot", token, DiscordGatewayBotSchema);
  }

  public static async getBotProfile(token: string): Promise<BotDiscordProfile> {
    const user = await this.botRequest("/users/@me", token, DiscordUserSchema);

    return {
      name: user.username,
      displayName: user.global_name,
      discriminator: user.discriminator,
      avatarUrl: this.avatarUrl(user.id, user.avatar),
      bannerUrl: this.cdnUrl("banners", user.id, user.banner ?? null),
      accentColor: user.accent_color ?? null,
    };
  }

  public static async getUserById(token: string, id: string): Promise<DiscordUser> {
    return await this.botRequest(`/users/${id}`, token, DiscordUserSchema, {
      404: new BadRequestException({ message: "No Discord user has this ID" }),
    });
  }

  public static authorizationUrl(redirectUri: string, state: string) {
    const url = new URL("/oauth2/authorize", env.DISCORD_URL);
    url.search = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      response_type: "code",
      scope: "identify",
      redirect_uri: redirectUri,
      state,
      prompt: "none",
    }).toString();

    return url.toString();
  }

  public static async getAccessToken(code: string, redirectUri: string) {
    const credentials = Buffer.from(`${env.DISCORD_CLIENT_ID}:${env.DISCORD_CLIENT_SECRET}`);

    const { access_token } = await this.request("/oauth2/token", DiscordAccessTokenSchema, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials.toString("base64")}` },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      errors: { 400: new UnauthorizedException({ message: "Invalid Discord authorization code" }) },
    });

    return access_token;
  }

  public static async getUser(accessToken: string): Promise<DiscordUser> {
    return await this.request("/users/@me", DiscordUserSchema, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}
