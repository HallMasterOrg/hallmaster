import { jest } from '@jest/globals';
import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';

import { DiscordService } from './discord.service.js';

const TOKEN = 'a-bot-token';
const BOT_ID = '1352006130926096504';

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    json: () => Promise.resolve(body),
  }) as Response;

describe('DiscordService', () => {
  const service = new DiscordService();
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn<typeof fetch>();

  beforeAll(() => {
    globalThis.fetch = fetchMock;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('getGatewayBot', () => {
    it('returns the recommended shard count', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { shards: 4 }));

      await expect(service.getGatewayBot(TOKEN)).resolves.toEqual({ shards: 4 });
    });

    it('throws UnauthorizedException on a 401 (invalid token)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

      await expect(service.getGatewayBot(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws a 424 when the Discord API errors', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

      await expect(service.getGatewayBot(TOKEN)).rejects.toMatchObject({ status: HttpStatus.FAILED_DEPENDENCY });
    });

    it('throws a 424 when the shard count is missing', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

      await expect(service.getGatewayBot(TOKEN)).rejects.toBeInstanceOf(HttpException);
    });

    it('maps a network failure / timeout to a 424', async () => {
      fetchMock.mockRejectedValueOnce(new Error('timeout'));

      await expect(service.getGatewayBot(TOKEN)).rejects.toMatchObject({ status: HttpStatus.FAILED_DEPENDENCY });
    });
  });

  describe('getCurrentUser', () => {
    it('maps the user and builds CDN URLs (png avatar, animated gif banner)', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          id: BOT_ID,
          username: 'HallMaster',
          global_name: 'HallMaster Bot',
          discriminator: '0',
          avatar: 'abc123',
          banner: 'a_def456',
          accent_color: 5793266,
        }),
      );

      await expect(service.getCurrentUser(TOKEN)).resolves.toEqual({
        name: 'HallMaster',
        displayName: 'HallMaster Bot',
        discriminator: '0',
        avatarUrl: `https://cdn.discordapp.com/avatars/${BOT_ID}/abc123.png`,
        bannerUrl: `https://cdn.discordapp.com/banners/${BOT_ID}/a_def456.gif`,
        accentColor: 5793266,
      });
    });

    it('returns null URLs, displayName and accentColor when the bot has none', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          id: BOT_ID,
          username: 'HallMaster',
          global_name: null,
          discriminator: '0001',
          avatar: null,
          banner: null,
          accent_color: null,
        }),
      );

      await expect(service.getCurrentUser(TOKEN)).resolves.toEqual({
        name: 'HallMaster',
        displayName: null,
        discriminator: '0001',
        avatarUrl: null,
        bannerUrl: null,
        accentColor: null,
      });
    });
  });
});
