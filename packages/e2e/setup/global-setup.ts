import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

import { BOT_ID, BOT_PROFILE, BOT_TOKEN, RECOMMENDED_SHARDS } from "./fixtures";

declare module "vitest" {
  export interface ProvidedContext {
    baseURL: string;
  }
}

const root = fileURLToPath(new URL("../../../", import.meta.url));
const backendDir = `${root}packages/backend`;
const frontendDir = `${root}packages/frontend`;
const logsDir = fileURLToPath(new URL("../.logs/", import.meta.url));

function pnpm(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  execFileSync("pnpm", args, { cwd: options.cwd ?? root, env: options.env, stdio: "inherit" });
}

async function freePort() {
  const server = createNetServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));

  return port;
}

function start(name: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const log = createWriteStream(`${logsDir}${name}.log`);
  const child = spawn("node", args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);

  return child;
}

async function waitUntilUp(name: string, url: string, child: ChildProcess) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited with code ${child.exitCode}, see .logs/${name}.log`);
    }

    const ok = await fetch(url).then(
      (response) => response.status < 500,
      () => false,
    );
    if (ok) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`${name} did not answer on ${url} within 60 s, see .logs/${name}.log`);
}

// Answers the two Discord routes the backend calls, so the tests never reach Discord.
async function startFakeDiscord(port: number) {
  const server: Server = createServer((request, response) => {
    const reply = (status: number, body: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };

    if (request.headers.authorization !== `Bot ${BOT_TOKEN}`) {
      reply(401, { message: "401: Unauthorized", code: 0 });
      return;
    }

    switch (request.url) {
      case "/gateway/bot":
        reply(200, { url: "wss://gateway.discord.gg", shards: RECOMMENDED_SHARDS });
        return;
      case "/users/@me":
        reply(200, BOT_PROFILE);
        return;
      default:
        reply(404, { message: "404: Not Found", code: 0 });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

  return server;
}

function removeBotContainers() {
  const ids = execFileSync("docker", ["ps", "-aq", "--filter", `name=${BOT_ID}-`])
    .toString()
    .split("\n")
    .filter(Boolean);

  if (ids.length > 0) {
    execFileSync("docker", ["rm", "--force", ...ids], { stdio: "ignore" });
  }
}

export default async function setup(project: TestProject) {
  mkdirSync(logsDir, { recursive: true });
  removeBotContainers();

  if (process.env.E2E_SKIP_BUILD === undefined) {
    pnpm(["--filter", "@hallmaster/backend", "prisma:generate"]);
    pnpm(["--filter", "@hallmaster/backend", "build"]);
    pnpm(["--filter", "@hallmaster/frontend", "build"]);
  }

  const database = await new PostgreSqlContainer("postgres:17-alpine").start();
  const databaseUrl = database.getConnectionUri();
  pnpm(["exec", "prisma", "migrate", "deploy"], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const [discordPort, backendPort, frontendPort] = [
    await freePort(),
    await freePort(),
    await freePort(),
  ];
  const discord = await startFakeDiscord(discordPort);

  const backend = start("backend", ["dist/index.mjs"], backendDir, {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    SECRET: "e2e-secret-e2e-secret-e2e-secret",
    PORT: String(backendPort),
    DISCORD_API_URL: `http://127.0.0.1:${discordPort}`,
  });
  await waitUntilUp("backend", `http://127.0.0.1:${backendPort}/openapi.json`, backend);

  const baseURL = `http://localhost:${frontendPort}`;
  const frontend = start("frontend", ["build"], frontendDir, {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(frontendPort),
    ORIGIN: baseURL,
    API_URL: `http://127.0.0.1:${backendPort}`,
  });
  await waitUntilUp("frontend", `${baseURL}/login`, frontend);

  project.provide("baseURL", baseURL);

  return async () => {
    frontend.kill();
    backend.kill();
    await new Promise<void>((resolve) => discord.close(() => resolve()));
    await database.stop();
    removeBotContainers();
  };
}
