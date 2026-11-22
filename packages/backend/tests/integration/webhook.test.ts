import {
  DockerContainersAPI,
  DockerImagesAPI,
  type DockerContainerCreationBody,
} from "@hallmaster/docker.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "#lib/database";
import socket from "#lib/docker";
import env from "#lib/env";

import {
  containerImage,
  containerState,
  createBot,
  previousContainerState,
  register,
  request,
  resetState,
  settled,
} from "./helpers";

const REGISTRY_CONTAINER = "hallmaster-test-registry";
const REGISTRY = "localhost:5056";
const USERNAME = "ci";
const PASSWORD = "secret";
const HTPASSWD = "ci:$2y$05$k0BRP1zpeKdOjNklBLVU6OJW0wtRTfu83cU9HnFLeaOt7bmGpMzda";
const HALF_A_SECOND = 500_000_000;
const TAGS = ["v1", "v2", "healthy", "unhealthy", "crashing"];

type HostConfig = DockerContainerCreationBody["HostConfig"];

const containers = new DockerContainersAPI(socket);
const images = new DockerImagesAPI(socket);

let sessionToken: string;
let webhookToken: string;

async function removeRegistry() {
  await containers.stop(REGISTRY_CONTAINER).catch(() => undefined);
  await containers.remove(REGISTRY_CONTAINER).catch(() => undefined);
}

async function startRegistry() {
  await images.create({ fromImage: "registry", tag: "2" });
  await removeRegistry();

  const { Id } = await containers.create(
    {
      Image: "registry:2",
      Cmd: [
        "sh",
        "-c",
        'echo "$HTPASSWD" > /htpasswd && exec registry serve /etc/docker/registry/config.yml',
      ],
      Env: [
        `HTPASSWD=${HTPASSWD}`,
        "REGISTRY_AUTH=htpasswd",
        "REGISTRY_AUTH_HTPASSWD_REALM=hallmaster",
        "REGISTRY_AUTH_HTPASSWD_PATH=/htpasswd",
      ],
      ExposedPorts: { "5000/tcp": {} },
      HostConfig: {
        PortBindings: { "5000/tcp": [{ HostPort: "5056" }] },
      } as Partial<HostConfig> as HostConfig,
    },
    REGISTRY_CONTAINER,
  );
  await containers.start(Id);

  await vi.waitFor(() => fetch(`http://${REGISTRY}/v2/`), { timeout: 15_000, interval: 100 });
}

async function pushBotImage(tag: string, config?: Record<string, unknown>) {
  if (config === undefined) {
    await images.tag("nginx:alpine", { repo: `${REGISTRY}/bot`, tag });
  } else {
    const { Id } = await containers.create({ Image: "nginx:alpine" });
    await socket.apiCall("POST", "/commit", {
      query: { container: Id, repo: `${REGISTRY}/bot`, tag },
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    await containers.remove(Id);
  }

  await images.push(`${REGISTRY}/bot`, {
    tag,
    auth: { serveraddress: REGISTRY, username: USERNAME, password: PASSWORD },
  });
}

type Deployment = { id: string; image: string; status: string; message: string | null };

async function regenerateWebhookToken() {
  const response = await request("/bot/webhook/token", { method: "POST", token: sessionToken });

  return ((await response.json()) as { token: string }).token;
}

async function deploy(body: unknown, token: string | null = webhookToken) {
  const response = await request("/webhooks/deploy", {
    method: "POST",
    token: token ?? undefined,
    body,
  });

  return { status: response.status, body: (await response.json()) as Deployment };
}

async function deployment(id: string) {
  const response = await request(`/webhooks/deployments/${id}`, { token: webhookToken });

  return (await response.json()) as Deployment;
}

async function finished(id: string) {
  await settled();

  return deployment(id);
}

async function savedImage() {
  const response = await request("/bot/container-image", { token: sessionToken });

  return ((await response.json()) as { url: string }).url;
}

beforeAll(async () => {
  env.CLUSTER_READY_DELAY_SECONDS = 2;
  await images.create({ fromImage: "nginx", tag: "alpine" });
  await startRegistry();
  await pushBotImage("v1");
  await pushBotImage("v2");
  await pushBotImage("healthy", {
    Cmd: ["sh", "-c", "(sleep 2 && touch /tmp/ready) & exec nginx -g 'daemon off;'"],
    Healthcheck: {
      Test: ["CMD", "test", "-e", "/tmp/ready"],
      Interval: HALF_A_SECOND,
      StartInterval: HALF_A_SECOND,
      StartPeriod: 60 * 2 * HALF_A_SECOND,
      Retries: 1,
    },
  });
  await pushBotImage("unhealthy", {
    Healthcheck: { Test: ["CMD", "false"], Interval: HALF_A_SECOND, Retries: 1 },
  });
  await pushBotImage("crashing", { Cmd: ["sh", "-c", "exit 3"] });
});

afterAll(async () => {
  env.CLUSTER_READY_DELAY_SECONDS = 0;
  await resetState();
  await removeRegistry();
  for (const tag of TAGS) {
    await images.remove(`${REGISTRY}/bot:${tag}`).catch(() => undefined);
  }
});

beforeEach(async () => {
  await resetState();
  sessionToken = await register();
  await createBot();
  webhookToken = await regenerateWebhookToken();

  const image = await request("/bot/container-image", {
    method: "POST",
    token: sessionToken,
    body: { url: `${REGISTRY}/bot:v1`, username: USERNAME, password: PASSWORD },
  });
  expect(image.status).toBe(201);

  const layout = await request("/clusters", {
    method: "PUT",
    token: sessionToken,
    body: [{ shardIds: [0] }, { shardIds: [1] }],
  });
  expect(layout.status).toBe(202);
  await settled();
});

describe("deploy webhook", () => {
  it.each([
    ["no token", null],
    ["a wrong token", "wrong-token"],
  ])("refuses a request with %s", async (_case, token) => {
    expect(await deploy({ tag: "v2" }, token)).toEqual({
      status: 401,
      body: { message: "Invalid webhook token" },
    });
  });

  it("refuses the session token of the dashboard", async () => {
    expect((await deploy({ tag: "v2" }, sessionToken)).status).toBe(401);
  });

  it("refuses the previous token once it is regenerated", async () => {
    const previous = webhookToken;
    webhookToken = await regenerateWebhookToken();

    expect((await deploy({ tag: "v2" }, previous)).status).toBe(401);
    expect((await deploy({ tag: "not a tag" })).status).toBe(400);
  });

  it("is disabled while no token is generated", async () => {
    await prisma.bot.updateMany({ data: { webhookTokenHash: null } });

    expect(await deploy({ tag: "v2" })).toEqual({
      status: 403,
      body: {
        message: "The webhook is disabled, generate a token in the dashboard settings to enable it",
      },
    });
  });

  it("only stores the hash of the token", async () => {
    const bot = await prisma.bot.findFirstOrThrow();

    expect(bot.webhookTokenHash).not.toContain(webhookToken);
    expect(await (await request("/bot/webhook", { token: sessionToken })).json()).toEqual({
      enabled: true,
    });
  });

  it.each(["v2@sha256:0", "../v2", ""])("rejects the tag %j", async (tag) => {
    expect((await deploy({ tag })).status).toBe(400);
  });

  it("answers 404 when the tag was not pushed", async () => {
    expect(await deploy({ tag: "v3" })).toEqual({
      status: 404,
      body: { message: `Image ${REGISTRY}/bot:v3 not found` },
    });
    expect(await containerImage(0)).toBe(`${REGISTRY}/bot:v1`);
  });

  it("answers 424 and keeps the running image when the registry refuses the saved credentials", async () => {
    await prisma.containerImage.updateMany({ data: { password: "wrong-password" } });

    const refused = await deploy({ tag: "v2" });

    expect(refused).toMatchObject({
      status: 424,
      body: {
        message: expect.stringContaining(`Registry ${REGISTRY} refused the saved credentials`),
      },
    });
    expect(await containerImage(0)).toBe(`${REGISTRY}/bot:v1`);
    expect(await containerState(0)).toBe("running");
  });

  it("replaces every cluster with the tag using the saved credentials, then saves it", async () => {
    const started = await deploy({ tag: "v2" });

    expect(started).toMatchObject({
      status: 202,
      body: { image: `${REGISTRY}/bot:v2`, status: "RUNNING", message: null },
    });
    expect(await finished(started.body.id)).toMatchObject({
      status: "SUCCEEDED",
      message: null,
    });
    expect(await containerImage(0)).toBe(`${REGISTRY}/bot:v2`);
    expect(await containerImage(1)).toBe(`${REGISTRY}/bot:v2`);
    expect(await containerState(0)).toBe("running");
    expect(await previousContainerState(0)).toBeUndefined();
    expect(await savedImage()).toBe(`${REGISTRY}/bot:v2`);
  });

  it("refuses another deployment and the dashboard actions while one runs", async () => {
    const started = await deploy({ tag: "v2" });

    expect((await deploy({ tag: "v2" })).status).toBe(409);
    expect(
      (await request("/clusters/1/stop", { method: "POST", token: sessionToken })).status,
    ).toBe(409);
    expect((await request("/bot", { method: "DELETE", token: sessionToken })).status).toBe(409);

    expect((await finished(started.body.id)).status).toBe("SUCCEEDED");
    expect(await containerState(1)).toBe("running");
  });
});

describe("rolling deployment", () => {
  it("replaces the clusters one by one, each once the previous one is healthy", async () => {
    const started = await deploy({ tag: "healthy" });

    await vi.waitFor(async () => expect(await containerImage(0)).toBe(`${REGISTRY}/bot:healthy`), {
      timeout: 15_000,
      interval: 100,
    });
    expect(await containerImage(1)).toBe(`${REGISTRY}/bot:v1`);
    expect(await containerState(1)).toBe("running");

    expect((await finished(started.body.id)).status).toBe("SUCCEEDED");
    expect(await containerImage(1)).toBe(`${REGISTRY}/bot:healthy`);
    expect(await savedImage()).toBe(`${REGISTRY}/bot:healthy`);
  });

  it.each([
    ["unhealthy", "the container is unhealthy"],
    ["crashing", "the container exited with code 3"],
  ])(
    "brings every cluster back to the previous image when the new one is %s",
    async (tag, reason) => {
      const started = await deploy({ tag });

      expect(await finished(started.body.id)).toMatchObject({
        status: "FAILED",
        message: expect.stringContaining(
          `Cluster 0 could not run ${REGISTRY}/bot:${tag}, ${reason}`,
        ),
      });
      for (const id of [0, 1]) {
        expect(await containerImage(id)).toBe(`${REGISTRY}/bot:v1`);
        expect(await containerState(id)).toBe("running");
        expect(await previousContainerState(id)).toBeUndefined();
      }
      expect(await savedImage()).toBe(`${REGISTRY}/bot:v1`);

      const alerts = await request("/alerts?active=true", { token: sessionToken });
      expect(await alerts.json()).toEqual([
        expect.objectContaining({ clusterId: 0, kind: "DEPLOY_FAILED" }),
      ]);
    },
  );
});
