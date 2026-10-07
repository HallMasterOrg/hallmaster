import { HTTPException } from "hono/http-exception";
import type z from "zod";

import type { BotDiscordProfile } from "#schemas/bot.schema";
import {
  DiscordGatewayBotSchema,
  DiscordUserSchema,
  type DiscordGatewayBot,
} from "#schemas/discord.schema";

export default class DiscordService {
  private static readonly DISCORD_API_BASE_URL = "https://discord.com/api/v10";
  private static readonly DISCORD_CDN_BASE_URL = "https://cdn.discordapp.com";

  private static async request<S extends z.ZodType>(
    path: `/${string}`,
    token: string,
    schema: S,
  ): Promise<z.infer<S>> {
    const response = await fetch(`${DiscordService.DISCORD_API_BASE_URL}${path}`, {
      headers: { Authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {
      throw new HTTPException(424, { message: "Discord API is unreachable or timed out" });
    });

    if (response.status === 401)
      throw new HTTPException(424, { message: "Invalid Discord bot token" });

    if (!response.ok) {
      throw new HTTPException(424, {
        message: `Discord API returned a ${response.status} ${response.statusText}`,
      });
    }

    try {
      return schema.parse(await response.json());
    } catch (error) {
      throw new HTTPException(424, {
        message: "Discord API returned an unexpected response body",
        cause: error,
      });
    }
  }

  private static cdnUrl(kind: "avatar" | "banner", id: string, hash: string) {
    const extension = hash.startsWith("a_") ? "gif" : "png";

    return `${this.DISCORD_CDN_BASE_URL}/${kind}/${id}/${hash}.${extension}`;
  }

  public static async getGatewayBot(token: string): Promise<DiscordGatewayBot> {
    return await this.request("/gateway/bot", token, DiscordGatewayBotSchema);
  }

  public static async getBotProfile(token: string): Promise<BotDiscordProfile> {
    const user = await this.request("/users/@me", token, DiscordUserSchema);

    return {
      name: user.username,
      displayName: user.global_name,
      discriminator: user.discriminator,
      avatarUrl: user.avatar ? this.cdnUrl("avatar", user.id, user.avatar) : null,
      bannerUrl: user.banner ? this.cdnUrl("banner", user.id, user.banner) : null,
      accentColor: user.accent_color,
    };
  }
}
