import { DockerContainersAPI } from "@hallmaster/docker.js";
import { vi } from "vitest";

import prisma from "#lib/database";
import socket from "#lib/docker";
import type { DiscordUser } from "#schemas/discord.schema";
import DiscordService from "#services/discord.service";

import app from "../../src/app";

export const BOT_ID = "424242424242424242";

export const REDIRECT_URI = "http://localhost/login/discord/callback";

export const OWNER: DiscordUser = {
  id: "111111111111111111",
  username: "owner",
  global_name: "Owner",
  discriminator: "0",
  avatar: null,
};

const containers = new DockerContainersAPI(socket);

async function findContainer(clusterId: number) {
  const name = `${BOT_ID}-${clusterId}`;
  const matches = await containers.list({ all: true, filters: { name: [name] } });

  return matches.find(({ Names }) => Names.includes(`/${name}`));
}

export async function containerState(clusterId: number) {
  return (await findContainer(clusterId))?.State;
}

export async function stopContainerOutsideHallMaster(clusterId: number) {
  const container = await findContainer(clusterId);
  if (container !== undefined) {
    await containers.stop(container.Id);
  }
}

export async function removeContainerOutsideHallMaster(clusterId: number) {
  const container = await findContainer(clusterId);
  if (container !== undefined) {
    await containers.stop(container.Id);
    await containers.remove(container.Id);
  }
}

export async function resetState() {
  await prisma.$executeRawUnsafe('TRUNCATE "User", "bot" CASCADE');

  const leftovers = await containers.list({ all: true, filters: { name: [`${BOT_ID}-`] } });
  for (const container of leftovers) {
    await containers.stop(container.Id);
    await containers.remove(container.Id);
  }
}

export async function createBot() {
  await prisma.bot.create({ data: { id: BOT_ID, token: "integration.token", totalShards: 0 } });
}

export function request(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (init.token !== undefined) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  return app.request(`/api${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export function logInWithDiscord(user: DiscordUser) {
  vi.spyOn(DiscordService, "getAccessToken").mockResolvedValue("access-token");
  vi.spyOn(DiscordService, "getUser").mockResolvedValue(user);

  return request("/auth/discord", {
    method: "POST",
    body: { code: "code", redirectUri: REDIRECT_URI },
  });
}

export const ADMIN: DiscordUser = {
  id: "222222222222222222",
  username: "admin",
  global_name: "Admin",
  discriminator: "0",
  avatar: null,
};

export function addAdmin(token: string, user: DiscordUser) {
  vi.spyOn(DiscordService, "getUserById").mockResolvedValue(user);

  return request("/users", { method: "POST", token, body: { id: user.id } });
}

export async function register() {
  const response = await logInWithDiscord(OWNER);
  const { token } = (await response.json()) as { token: string };

  return token;
}

export async function openEvents(path: string, token: string) {
  const response = await request(path, { token });
  if (response.body === null) {
    throw new Error(`No body for ${path}`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  async function read(count: number) {
    const events: unknown[] = [];

    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += value;
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const data = block.split("\n").find((line) => line.startsWith("data: "));
        if (data !== undefined) {
          events.push(JSON.parse(data.slice("data: ".length)));
        }
      }
    }

    await reader.cancel();

    return events;
  }

  return { status: response.status, contentType: response.headers.get("Content-Type"), read };
}
