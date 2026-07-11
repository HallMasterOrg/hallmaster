import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';

const DISCORD_API_VERSION = 'v10';
const DISCORD_API_BASE_URL = `https://discord.com/api/${DISCORD_API_VERSION}`;
const DISCORD_CDN_BASE_URL = 'https://cdn.discordapp.com';
const DISCORD_REQUEST_TIMEOUT_MS = 10_000;

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

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  discriminator: string;
  avatar: string | null;
  banner: string | null;
  accent_color: number | null;
}

@Injectable()
export class DiscordService {
  private async request<T>(path: string, token: string): Promise<T> {
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

    return (await response.json()) as T;
  }

  async getGatewayBot(token: string): Promise<DiscordGatewayBot> {
    const data = await this.request<{ shards?: number }>('/gateway/bot', token);

    if (typeof data.shards !== 'number') {
      throw new HttpException('Got an invalid response from the Discord API.', HttpStatus.FAILED_DEPENDENCY);
    }

    return { shards: data.shards };
  }

  async getCurrentUser(token: string): Promise<DiscordProfile> {
    const user = await this.request<DiscordUser>('/users/@me', token);

    return {
      name: user.username,
      displayName: user.global_name ?? null,
      discriminator: user.discriminator,
      avatarUrl: DiscordService.buildCdnUrl('avatars', user.id, user.avatar),
      bannerUrl: DiscordService.buildCdnUrl('banners', user.id, user.banner),
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
