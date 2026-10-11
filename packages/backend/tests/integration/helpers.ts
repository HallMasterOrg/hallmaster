import { DockerContainersAPI, DockerSocket } from "@hallmaster/docker.js";

import prisma from "#lib/database";

import app from "../../src/app";

export const BOT_ID = "424242424242424242";

const socket = new DockerSocket();
await socket.init();
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

export async function register() {
  const response = await request("/auth/register", {
    method: "POST",
    body: { username: "admin", password: "password123" },
  });
  const { token } = (await response.json()) as { token: string };

  return token;
}
