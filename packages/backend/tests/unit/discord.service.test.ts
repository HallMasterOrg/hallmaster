import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DiscordService from "#services/discord.service";

vi.mock("#lib/env", () => ({
  default: {
    DISCORD_URL: "https://discord.com",
    DISCORD_CLIENT_ID: "client-id",
    DISCORD_CLIENT_SECRET: "client-secret",
  },
}));

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

describe("oauth", () => {
  it("builds the authorization page of the application", () => {
    const url = new URL(DiscordService.authorizationUrl("http://localhost/callback", "state"));

    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-id",
      response_type: "code",
      scope: "identify",
      redirect_uri: "http://localhost/callback",
      state: "state",
      prompt: "none",
    });
  });

  it("exchanges a code with the application credentials", async () => {
    respond(200, { access_token: "access-token", token_type: "Bearer" });

    expect(await DiscordService.getAccessToken("code", "http://localhost/callback")).toBe(
      "access-token",
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/v10/oauth2/token");
    expect(init).toMatchObject({
      method: "POST",
      headers: { Authorization: `Basic ${btoa("client-id:client-secret")}` },
    });
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "code",
      redirect_uri: "http://localhost/callback",
    });
  });

  it("reports a code Discord does not accept", async () => {
    respond(400, { error: "invalid_grant" });

    await expect(
      DiscordService.getAccessToken("code", "http://localhost/callback"),
    ).rejects.toMatchObject({ status: 401, message: "Invalid Discord authorization code" });
  });

  it("reports wrong application credentials as a Discord failure", async () => {
    respond(401, { error: "invalid_client" });

    await expect(
      DiscordService.getAccessToken("code", "http://localhost/callback"),
    ).rejects.toMatchObject({ status: 424 });
  });

  it("reads the user behind an access token", async () => {
    const user = {
      id: "42",
      username: "owner",
      global_name: "Owner",
      discriminator: "0",
      avatar: null,
    };
    respond(200, user);

    expect(await DiscordService.getUser("access-token")).toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/users/@me",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token" } }),
    );
  });
});

describe("user by id", () => {
  it("looks the user up with the bot token", async () => {
    const user = {
      id: "42",
      username: "admin",
      global_name: null,
      discriminator: "0",
      avatar: null,
    };
    respond(200, user);

    expect(await DiscordService.getUserById("token", "42")).toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/users/42",
      expect.objectContaining({ headers: { Authorization: "Bot token" } }),
    );
  });

  it("reports an unknown user", async () => {
    respond(404, { message: "Unknown User", code: 10013 });

    await expect(DiscordService.getUserById("token", "42")).rejects.toMatchObject({
      status: 400,
      message: "No Discord user has this ID",
    });
  });

  it("still reports an invalid bot token", async () => {
    respond(401);

    await expect(DiscordService.getUserById("token", "42")).rejects.toMatchObject({
      status: 424,
      message: "Invalid Discord bot token",
    });
  });
});
