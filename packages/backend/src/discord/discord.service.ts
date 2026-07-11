import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';

const DISCORD_API_VERSION = 'v10';
const DISCORD_API_BASE_URL = `https://discord.com/api/${DISCORD_API_VERSION}`;
const DISCORD_CDN_BASE_URL = 'https://cdn.discordapp.com';
const DISCORD_REQUEST_TIMEOUT_MS = 10_000;

const DiscordGatewayBotSchema = z.object({
  shards: z.number().int().nonnegative(),
});

const DiscordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullish(),
  discriminator: z.string(),
  avatar: z.string().nullish(),
  banner: z.string().nullish(),
  accent_color: z.number().int().nullish(),
});

export interface DiscordGatewayBot {
  shards: number;
}

export interface DiscordProfile {
  name: string;
  displayName: string | null;
  discriminator: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: number | null;
}

@Injectable()
export class DiscordService {
  private async request<S extends z.ZodType>(path: string, token: string, schema: S): Promise<z.infer<S>> {
    let response: Response;
    try {
      response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
        headers: { Authorization: `Bot ${token}` },
        signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new HttpException('The Discord API is unreachable or timed out.', HttpStatus.FAILED_DEPENDENCY);
    }

    if (response.status === 401) {
      throw new UnauthorizedException('Invalid Discord bot token.');
    }

    if (!response.ok) {
      throw new HttpException(
        `Discord API returned ${response.status}: ${response.statusText}`,
        HttpStatus.FAILED_DEPENDENCY,
      );
    }

    const payload: unknown = await response.json().catch(() => undefined);
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpException('The Discord API returned an unexpected response.', HttpStatus.FAILED_DEPENDENCY);
    }

    return parsed.data;
  }

  async getGatewayBot(token: string): Promise<DiscordGatewayBot> {
    return await this.request('/gateway/bot', token, DiscordGatewayBotSchema);
  }

  async getCurrentUser(token: string): Promise<DiscordProfile> {
    const user = await this.request('/users/@me', token, DiscordUserSchema);

    return {
      name: user.username,
      displayName: user.global_name ?? null,
      discriminator: user.discriminator,
      avatarUrl: DiscordService.buildCdnUrl('avatars', user.id, user.avatar ?? null),
      bannerUrl: DiscordService.buildCdnUrl('banners', user.id, user.banner ?? null),
      accentColor: user.accent_color ?? null,
    };
  }

  private static buildCdnUrl(kind: 'avatars' | 'banners', id: string, hash: string | null): string | null {
    if (!hash) {
      return null;
    }

    const extension = hash.startsWith('a_') ? 'gif' : 'png';
    return `${DISCORD_CDN_BASE_URL}/${kind}/${id}/${hash}.${extension}`;
  }
}
