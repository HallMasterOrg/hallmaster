import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DiscordService from "#services/discord.service";

const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("gateway bot", () => {
  it("returns the recommended number of shards", async () => {
    respond(200, { url: "wss://gateway.discord.gg", shards: 3 });

    expect(await DiscordService.getGatewayBot("token")).toEqual({ shards: 3 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/gateway/bot",
      expect.objectContaining({ headers: { Authorization: "Bot token" } }),
    );
  });

  it("reports an invalid token", async () => {
    respond(401);

    await expect(DiscordService.getGatewayBot("token")).rejects.toMatchObject({
      status: 424,
      message: "Invalid Discord bot token",
    });
  });

  it("reports an unavailable Discord API", async () => {
    respond(503);

    await expect(DiscordService.getGatewayBot("token")).rejects.toMatchObject({ status: 424 });
  });

  it("reports an unreachable Discord API", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(DiscordService.getGatewayBot("token")).rejects.toMatchObject({
      status: 424,
      message: "Discord API is unreachable or timed out",
    });
  });

  it("reports an unexpected response body", async () => {
    respond(200, { shards: "many" });

    await expect(DiscordService.getGatewayBot("token")).rejects.toMatchObject({
      status: 424,
      message: "Discord API returned an unexpected response body",
    });
  });
});

describe("bot profile", () => {
  it("builds the profile with cdn urls", async () => {
    respond(200, {
      id: "42",
      username: "hallmaster",
      global_name: "HallMaster",
      discriminator: "0",
      avatar: "a_animated",
      banner: "static",
      accent_color: 16711680,
    });

    expect(await DiscordService.getBotProfile("token")).toEqual({
      name: "hallmaster",
      displayName: "HallMaster",
      discriminator: "0",
      avatarUrl: "https://cdn.discordapp.com/avatars/42/a_animated.gif",
      bannerUrl: "https://cdn.discordapp.com/banners/42/static.png",
      accentColor: 16711680,
    });
  });

  it("accepts a profile without avatar, banner or accent color", async () => {
    respond(200, {
      id: "42",
      username: "hallmaster",
      global_name: null,
      discriminator: "0",
      avatar: null,
    });

    expect(await DiscordService.getBotProfile("token")).toMatchObject({
      displayName: null,
      avatarUrl: null,
      bannerUrl: null,
      accentColor: null,
    });
  });
});
