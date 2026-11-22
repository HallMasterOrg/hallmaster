import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { containerEnvironment, createBot, register, request, resetState, settled } from "./helpers";

let token: string;

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await request(path, { ...init, token });
  const body = (await response.json()) as unknown;
  await settled();

  return { status: response.status, body };
}

function putEnvironment(variables: unknown) {
  return call("/bot/environment", { method: "PUT", body: { variables } });
}

afterAll(async () => {
  await resetState();
});

beforeEach(async () => {
  await resetState();
  token = await register();
});

describe("environment variables", () => {
  beforeEach(async () => {
    await createBot();
  });

  it("starts empty", async () => {
    expect(await call("/bot/environment")).toEqual({ status: 200, body: { variables: [] } });
  });

  it("replaces every variable at once", async () => {
    await putEnvironment([
      { key: "LOG_LEVEL", value: "debug" },
      { key: "OLD", value: "1" },
    ]);

    const updated = await putEnvironment([
      { key: "LOG_LEVEL", value: "info" },
      { key: "DATABASE_URL", value: "postgres://bot:secret@db/bot?ssl=true" },
    ]);

    const variables = [
      { key: "DATABASE_URL", value: "postgres://bot:secret@db/bot?ssl=true" },
      { key: "LOG_LEVEL", value: "info" },
    ];
    expect(updated).toEqual({ status: 200, body: { variables } });
    expect(await call("/bot/environment")).toEqual({ status: 200, body: { variables } });
  });

  it("refuses a body without variables", async () => {
    const { status, body } = await call("/bot/environment", { method: "PUT", body: {} });

    expect(status).toBe(400);
    expect(body).toMatchObject({ issues: [{ path: "variables" }] });
  });

  it.each([
    [
      "a variable set by HallMaster",
      [{ key: "DISCORD_BOT_TOKEN", value: "other" }],
      "variables.0.key",
    ],
    ["an invalid name", [{ key: "1_FOO", value: "bar" }], "variables.0.key"],
    [
      "a variable set twice",
      [
        { key: "FOO", value: "1" },
        { key: "FOO", value: "2" },
      ],
      "variables.1.key",
    ],
  ])("refuses %s", async (_case, variables, path) => {
    const { status, body } = await putEnvironment(variables);

    expect(status).toBe(400);
    expect(body).toMatchObject({ issues: [{ path }] });
    expect((await call("/bot/environment")).body).toEqual({ variables: [] });
  });
});

describe("clusters", () => {
  beforeEach(async () => {
    await createBot();
    expect(
      (await call("/bot/container-image", { method: "POST", body: { url: "nginx:alpine" } }))
        .status,
    ).toBe(201);
  });

  it("receive the variables when they are deployed", async () => {
    await putEnvironment([{ key: "LOG_LEVEL", value: "debug" }]);
    await call("/clusters", { method: "PUT", body: [{ shardIds: [0] }] });

    expect(await containerEnvironment(0)).toEqual(
      expect.arrayContaining(["LOG_LEVEL=debug", "DISCORD_BOT_TOKEN=integration.token"]),
    );

    await putEnvironment([]);
    expect(await containerEnvironment(0)).toContain("LOG_LEVEL=debug");

    await call("/clusters", { method: "PUT", body: [{ id: 0, shardIds: [0] }] });
    expect(await containerEnvironment(0)).not.toContain("LOG_LEVEL=debug");
  });

  it("receive the new variables when the same layout is applied again", async () => {
    await call("/clusters", { method: "PUT", body: [{ shardIds: [0] }, { shardIds: [1] }] });
    await call("/clusters/1/stop", { method: "POST" });
    await putEnvironment([{ key: "LOG_LEVEL", value: "info" }]);

    const redeployed = await call("/clusters", {
      method: "PUT",
      body: [
        { id: 0, shardIds: [0] },
        { id: 1, shardIds: [1] },
      ],
    });

    expect(redeployed).toEqual({
      status: 202,
      body: [
        { id: 0, shardIds: [0], status: "STARTING" },
        { id: 1, shardIds: [1], status: "STOPPED" },
      ],
    });
    expect(await containerEnvironment(0)).toContain("LOG_LEVEL=info");
    expect(await containerEnvironment(1)).toContain("LOG_LEVEL=info");
  });

  it("are outdated until they are redeployed with the saved variables", async () => {
    const layout = [{ shardIds: [0] }, { shardIds: [1] }];
    await call("/clusters", { method: "PUT", body: layout });
    expect(await call("/clusters/outdated")).toEqual({ status: 200, body: [] });

    await putEnvironment([{ key: "LOG_LEVEL", value: "info" }]);
    expect((await call("/clusters/outdated")).body).toEqual([0, 1]);

    await call("/clusters", {
      method: "PUT",
      body: layout.map((cluster, id) => ({ ...cluster, id })),
    });
    expect((await call("/clusters/outdated")).body).toEqual([]);
  });

  it("are outdated once the image changes", async () => {
    await call("/clusters", { method: "PUT", body: [{ shardIds: [0] }] });

    const updated = await call("/bot/container-image", {
      method: "PUT",
      body: { url: "nginx:stable-alpine" },
    });
    expect(updated.status).toBe(200);
    expect((await call("/clusters/outdated")).body).toEqual([0]);
  });
});

describe("without a bot", () => {
  it("reports it", async () => {
    expect(await call("/bot/environment")).toEqual({
      status: 404,
      body: { message: "Bot not found" },
    });
    expect((await putEnvironment([])).status).toBe(404);
  });
});
