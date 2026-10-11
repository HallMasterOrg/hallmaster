import { beforeEach, describe, expect, it, vi } from "vitest";

import { FailedDependancyException } from "#exceptions/http-exceptions";
import DiscordService from "#services/discord.service";

import { BOT_ID, register, request, resetState } from "./helpers";

vi.mock("#services/discord.service", () => ({
  default: {
    getBotProfile: vi.fn(),
    getGatewayBot: vi.fn(),
  },
}));

const DISCORD_TOKEN = `${Buffer.from(BOT_ID).toString("base64")}.timestamp.signature`;

let token: string;

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await request(path, { ...init, token });

  return { status: response.status, body: (await response.json()) as unknown };
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(DiscordService.getGatewayBot).mockResolvedValue({ shards: 2 });
  vi.mocked(DiscordService.getBotProfile).mockResolvedValue({
    name: "hallmaster",
    displayName: "HallMaster",
    discriminator: "0",
    avatarUrl: null,
    bannerUrl: null,
    accentColor: null,
  });

  await resetState();
  token = await register();
});

describe("bot registration", () => {
  it("registers a single bot from its Discord token", async () => {
    const created = await call("/bot", { method: "POST", body: { token: DISCORD_TOKEN } });

    expect(created).toEqual({ status: 201, body: { id: BOT_ID, shards: 0 } });
    expect(await call("/bot")).toEqual({ status: 200, body: { id: BOT_ID, shards: 0 } });
    expect(await call("/bot", { method: "POST", body: { token: DISCORD_TOKEN } })).toEqual({
      status: 409,
      body: { message: "A bot is already registered" },
    });
  });

  it("rejects an invalid Discord token", async () => {
    vi.mocked(DiscordService.getGatewayBot).mockRejectedValue(
      new FailedDependancyException({ message: "Invalid Discord bot token" }),
    );

    expect(await call("/bot", { method: "POST", body: { token: "invalid" } })).toEqual({
      status: 424,
      body: { message: "Invalid Discord bot token" },
    });
  });

  it("updates the bot token", async () => {
    await call("/bot", { method: "POST", body: { token: DISCORD_TOKEN } });

    const updated = await call("/bot", { method: "PUT", body: { token: `${DISCORD_TOKEN}2` } });

    expect(updated).toEqual({ status: 200, body: { id: BOT_ID, shards: 0 } });
    expect(DiscordService.getGatewayBot).toHaveBeenLastCalledWith(`${DISCORD_TOKEN}2`);
  });

  it("returns the Discord profile and the recommended shards", async () => {
    await call("/bot", { method: "POST", body: { token: DISCORD_TOKEN } });

    expect(await call("/bot/profile")).toMatchObject({
      status: 200,
      body: { name: "hallmaster", displayName: "HallMaster" },
    });
    expect(await call("/bot/recommended-shards")).toEqual({ status: 200, body: { shards: 2 } });
  });

  it("reports that no bot is registered", async () => {
    expect(await call("/bot")).toEqual({ status: 404, body: { message: "Bot not found" } });
  });
});

describe("container image", () => {
  beforeEach(async () => {
    await call("/bot", { method: "POST", body: { token: DISCORD_TOKEN } });
  });

  it("registers a single container image", async () => {
    expect(await call("/bot/container-image")).toEqual({
      status: 404,
      body: { message: "Container image not found" },
    });

    const created = await call("/bot/container-image", {
      method: "POST",
      body: { url: "nginx:alpine" },
    });

    expect(created).toEqual({ status: 201, body: { url: "docker.io/library/nginx:alpine" } });
    expect((await call("/bot/container-image")).body).toEqual({
      url: "docker.io/library/nginx:alpine",
    });
    expect(
      (await call("/bot/container-image", { method: "POST", body: { url: "nginx:alpine" } }))
        .status,
    ).toBe(409);
  });

  it("updates the container image without exposing the password", async () => {
    await call("/bot/container-image", { method: "POST", body: { url: "nginx:alpine" } });

    const updated = await call("/bot/container-image", {
      method: "PUT",
      body: { url: "docker.io/library/nginx:alpine", username: "deployer", password: "secret" },
    });

    expect(updated).toEqual({
      status: 200,
      body: { url: "docker.io/library/nginx:alpine", username: "deployer" },
    });
    expect(JSON.stringify((await call("/bot/container-image")).body)).not.toContain("secret");
  });

  it("refuses to update an image that was never registered", async () => {
    const { status } = await call("/bot/container-image", {
      method: "PUT",
      body: { url: "nginx:alpine" },
    });

    expect(status).toBe(404);
  });
});
