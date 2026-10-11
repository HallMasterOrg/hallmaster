import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  containerState,
  createBot,
  register,
  removeContainerOutsideHallMaster,
  request,
  resetState,
  stopContainerOutsideHallMaster,
} from "./helpers";

type Cluster = { id: number; shardIds: number[]; status: string };

let token: string;

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await request(path, { ...init, token });

  return { status: response.status, body: (await response.json()) as unknown };
}

async function applyLayout(layout: { id?: number; shardIds: number[] }[]) {
  const { status, body } = await call("/clusters", { method: "PUT", body: layout });
  expect(status).toBe(200);

  return body as Cluster[];
}

afterAll(async () => {
  await resetState();
});

beforeEach(async () => {
  await resetState();
  token = await register();
  await createBot();

  const { status } = await call("/bot/container-image", {
    method: "POST",
    body: { url: "nginx:alpine" },
  });
  expect(status).toBe(201);
});

describe("cluster layout", () => {
  it("starts every cluster of a new layout", async () => {
    const clusters = await applyLayout([{ shardIds: [0] }, { shardIds: [1, 2] }]);

    expect(clusters).toEqual([
      { id: 0, shardIds: [0], status: "RUNNING" },
      { id: 1, shardIds: [1, 2], status: "RUNNING" },
    ]);
    expect(await containerState(0)).toBe("running");
    expect(await containerState(1)).toBe("running");
    expect((await call("/bot")).body).toMatchObject({ shards: 3 });
  });

  it("keeps a stopped cluster stopped when the layout changes", async () => {
    await applyLayout([{ shardIds: [0] }]);
    await call("/clusters/0/stop", { method: "POST" });

    const clusters = await applyLayout([{ id: 0, shardIds: [0] }, { shardIds: [1] }]);

    expect(clusters).toEqual([
      { id: 0, shardIds: [0], status: "STOPPED" },
      { id: 1, shardIds: [1], status: "RUNNING" },
    ]);
  });

  it("recreates a cluster whose container was removed outside HallMaster", async () => {
    await applyLayout([{ shardIds: [0] }]);
    await removeContainerOutsideHallMaster(0);

    const clusters = await applyLayout([{ id: 0, shardIds: [0] }]);

    expect(clusters).toEqual([{ id: 0, shardIds: [0], status: "RUNNING" }]);
    expect(await containerState(0)).toBe("running");
  });
});

describe("cluster actions", () => {
  beforeEach(async () => {
    await applyLayout([{ shardIds: [0] }, { shardIds: [1] }]);
  });

  it("stops and starts a single cluster", async () => {
    expect((await call("/clusters/0/stop", { method: "POST" })).body).toMatchObject({
      status: "STOPPED",
    });
    expect(await containerState(0)).toBe("exited");
    expect(await containerState(1)).toBe("running");

    expect((await call("/clusters/0/start", { method: "POST" })).body).toMatchObject({
      status: "RUNNING",
    });
    expect(await containerState(0)).toBe("running");
  });

  it("reports the failures of an action applied to every cluster", async () => {
    await removeContainerOutsideHallMaster(1);

    const { body } = await call("/clusters/restart", { method: "POST" });

    expect(body).toEqual({
      succeeded: [0],
      failed: [{ id: 1, reason: expect.stringContaining("No such container") }],
    });
  });

  it("removes a running cluster", async () => {
    const { status } = await call("/clusters/0", { method: "DELETE" });

    expect(status).toBe(200);
    expect(await containerState(0)).toBeUndefined();
    expect((await call("/clusters")).body).toEqual([{ id: 1, shardIds: [1], status: "RUNNING" }]);
  });

  it("removes the bot and its containers", async () => {
    const { status } = await call("/bot", { method: "DELETE" });

    expect(status).toBe(200);
    expect(await containerState(0)).toBeUndefined();
    expect(await containerState(1)).toBeUndefined();
  });
});

describe("observed cluster status", () => {
  beforeEach(async () => {
    await applyLayout([{ shardIds: [0] }]);
  });

  it("reports a container stopped outside HallMaster as an error", async () => {
    await stopContainerOutsideHallMaster(0);

    expect((await call("/clusters/0")).body).toMatchObject({ status: "ERROR" });
  });

  it("reports a removed container as an error", async () => {
    await removeContainerOutsideHallMaster(0);

    expect((await call("/clusters/0")).body).toMatchObject({ status: "ERROR" });
  });
});

describe("cluster monitoring", () => {
  beforeEach(async () => {
    await applyLayout([{ shardIds: [0] }]);
  });

  it("returns the stats of a running cluster", async () => {
    const { status, body } = await call("/clusters/0/stats");

    expect(status).toBe(200);
    expect(body).toMatchObject({
      cpuPercentage: expect.any(Number),
      memory: { usage: expect.any(Number), percentage: expect.any(Number) },
    });
  });

  it("refuses the stats of a stopped cluster", async () => {
    await call("/clusters/0/stop", { method: "POST" });

    const { status, body } = await call("/clusters/0/stats");

    expect(status).toBe(400);
    expect(body).toEqual({ message: "Cluster 0 is not running" });
  });

  it("returns the logs of a cluster", async () => {
    const { status, body } = await call("/clusters/0/logs");

    expect(status).toBe(200);
    expect(body).toEqual(expect.any(Array));
  });
});
