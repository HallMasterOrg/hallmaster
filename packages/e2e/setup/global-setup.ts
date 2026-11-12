import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

import {
  BOT_ID,
  BOT_PROFILE,
  BOT_TOKEN,
  DISCORD_CLIENT,
  OWNER,
  RECOMMENDED_SHARDS,
  STRANGER,
} from "./fixtures";

declare module "vitest" {
  export interface ProvidedContext {
    baseURL: string;
    discordURL: string;
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

const DISCORD_USERS = new Map([OWNER, STRANGER].map((user) => [user.id, user]));
const CLIENT_CREDENTIALS = Buffer.from(`${DISCORD_CLIENT.id}:${DISCORD_CLIENT.secret}`);

function readBody(request: IncomingMessage) {
  return new Promise<URLSearchParams>((resolve) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => resolve(new URLSearchParams(body)));
  });
}

function discordUser(request: IncomingMessage) {
  const id = request.headers.cookie?.match(/(?:^|; )user=(\d+)/)?.[1] ?? OWNER.id;

  return DISCORD_USERS.get(id);
}

function bearerUser(authorization: string | undefined) {
  return DISCORD_USERS.get(authorization?.replace("Bearer access-", "") ?? "");
}

async function answerDiscord(request: IncomingMessage, response: ServerResponse) {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const { authorization } = request.headers;

  const userId = url.pathname.match(/^\/api\/v10\/users\/(\d+)$/)?.[1];
  const route = userId === undefined ? url.pathname : "/api/v10/users/:id";

  switch (`${request.method} ${route}`) {
    case "GET /oauth2/authorize": {
      const callback = new URL(url.searchParams.get("redirect_uri") ?? "");
      callback.searchParams.set("code", discordUser(request)?.id ?? "");
      callback.searchParams.set("state", url.searchParams.get("state") ?? "");
      response.writeHead(302, { Location: callback.toString() });
      response.end();
      return;
    }
    case "POST /api/v10/oauth2/token": {
      if (authorization !== `Basic ${CLIENT_CREDENTIALS.toString("base64")}`) {
        reply(401, { error: "invalid_client" });
        return;
      }

      const code = (await readBody(request)).get("code") ?? "";
      if (!DISCORD_USERS.has(code)) {
        reply(400, { error: "invalid_grant" });
        return;
      }

      reply(200, { access_token: `access-${code}`, token_type: "Bearer" });
      return;
    }
    case "GET /api/v10/users/@me": {
      const user = authorization === `Bot ${BOT_TOKEN}` ? BOT_PROFILE : bearerUser(authorization);
      if (user === undefined) {
        reply(401, { message: "401: Unauthorized", code: 0 });
        return;
      }

      reply(200, user);
      return;
    }
    case "GET /api/v10/users/:id": {
      if (authorization !== `Bot ${BOT_TOKEN}`) {
        reply(401, { message: "401: Unauthorized", code: 0 });
        return;
      }

      const user = DISCORD_USERS.get(userId ?? "");
      if (user === undefined) {
        reply(404, { message: "Unknown User", code: 10013 });
        return;
      }

      reply(200, user);
      return;
    }
    case "GET /api/v10/gateway/bot":
      if (authorization !== `Bot ${BOT_TOKEN}`) {
        reply(401, { message: "401: Unauthorized", code: 0 });
        return;
      }

      reply(200, { url: "wss://gateway.discord.gg", shards: RECOMMENDED_SHARDS });
      return;
    default:
      reply(404, { message: "404: Not Found", code: 0 });
  }
}

async function startFakeDiscord(port: number) {
  const server: Server = createServer((request, response) => {
    void answerDiscord(request, response);
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
  const discordURL = `http://127.0.0.1:${discordPort}`;
  const discord = await startFakeDiscord(discordPort);

  const backend = start("backend", ["dist/index.mjs"], backendDir, {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    SECRET: "e2e-secret-e2e-secret-e2e-secret",
    PORT: String(backendPort),
    DISCORD_URL: discordURL,
    DISCORD_CLIENT_ID: DISCORD_CLIENT.id,
    DISCORD_CLIENT_SECRET: DISCORD_CLIENT.secret,
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
  project.provide("discordURL", discordURL);

  return async () => {
    frontend.kill();
    backend.kill();
    await new Promise<void>((resolve) => discord.close(() => resolve()));
    await database.stop();
    removeBotContainers();
  };
}
