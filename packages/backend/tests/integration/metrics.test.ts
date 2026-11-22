import { setTimeout as sleep } from "node:timers/promises";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "#lib/database";
import MetricsService from "#services/metrics.service";

import { BOT_ID, createBot, register, request, resetState } from "./helpers";

type History = {
  from: string;
  to: string;
  interval: number;
  clusters: Record<string, { at: string; cpuPercentage: number; memory: { usage: number } }[]>;
};

let token: string;

async function history(range?: string) {
  const response = await request(`/clusters/stats/history${range ? `?range=${range}` : ""}`, {
    token,
  });

  return { status: response.status, body: (await response.json()) as History };
}

async function sample(clusterId: number, at: string, cpuPercentage: number) {
  await prisma.clusterSample.create({
    data: {
      botId: BOT_ID,
      clusterId,
      at: new Date(at),
      cpuPercentage,
      memoryUsage: BigInt(cpuPercentage * 1_000),
      memoryPercentage: cpuPercentage / 2,
    },
  });
}

function point(at: string, cpuPercentage: number) {
  return {
    at,
    cpuPercentage,
    memory: { usage: cpuPercentage * 1_000, percentage: cpuPercentage / 2 },
  };
}

afterAll(async () => {
  await resetState();
});

beforeEach(async () => {
  await resetState();
  await createBot();
});

afterEach(() => {
  MetricsService.stop();
  vi.useRealTimers();
});

describe("stats history", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date("2026-11-15T12:00:00.000Z"), toFake: ["Date"] });
    token = await register();
  });

  it("refuses a visitor without a session", async () => {
    const response = await request("/clusters/stats/history");

    expect(response.status).toBe(401);
  });

  it("refuses an unknown range", async () => {
    const { status } = await history("2h");

    expect(status).toBe(400);
  });

  it("averages the samples of the last hour over 15 seconds by default", async () => {
    await sample(0, "2026-11-15T11:30:01.000Z", 10);
    await sample(0, "2026-11-15T11:30:14.000Z", 30);
    await sample(0, "2026-11-15T11:30:15.000Z", 40);
    await sample(1, "2026-11-15T11:50:00.000Z", 50);
    await sample(0, "2026-11-15T10:59:59.000Z", 99);

    const { status, body } = await history();

    expect(status).toBe(200);
    expect(body).toEqual({
      from: "2026-11-15T11:00:00.000Z",
      to: "2026-11-15T12:00:00.000Z",
      interval: 15,
      clusters: {
        0: [point("2026-11-15T11:30:00.000Z", 20), point("2026-11-15T11:30:15.000Z", 40)],
        1: [point("2026-11-15T11:50:00.000Z", 50)],
      },
    });
  });

  it("averages a week of samples over 42 minutes", async () => {
    await sample(0, "2026-11-08T12:00:00.000Z", 10);
    await sample(0, "2026-11-08T12:41:59.000Z", 30);
    await sample(0, "2026-11-08T12:42:00.000Z", 60);

    const { body } = await history("7d");

    expect(body.interval).toBe(2_520);
    expect(body.clusters[0]).toEqual([
      point("2026-11-08T12:00:00.000Z", 20),
      point("2026-11-08T12:42:00.000Z", 60),
    ]);
  });

  it("is empty without samples", async () => {
    const { body } = await history("24h");

    expect(body.clusters).toEqual({});
  });
});

describe("retention", () => {
  it("deletes the samples older than the retention", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-15T12:00:00.000Z"), toFake: ["Date"] });
    await sample(0, "2026-11-08T11:59:59.000Z", 10);
    await sample(0, "2026-11-08T12:00:00.000Z", 20);

    await MetricsService.purge(7);

    expect(await prisma.clusterSample.findMany({ select: { at: true } })).toEqual([
      { at: new Date("2026-11-08T12:00:00.000Z") },
    ]);
  });
});

describe("collector", () => {
  beforeEach(async () => {
    token = await register();
  });

  async function call(path: string, init: { method?: string; body?: unknown } = {}) {
    const response = await request(path, { ...init, token });
    expect(response.status).toBeLessThan(300);
  }

  async function count() {
    await MetricsService.record();

    return prisma.clusterSample.count();
  }

  it("stores the stats of the running clusters until they stop", async () => {
    await call("/bot/container-image", { method: "POST", body: { url: "nginx:alpine" } });
    await call("/clusters", { method: "PUT", body: [{ shardIds: [0] }] });

    await MetricsService.sync();
    await vi.waitFor(async () => expect(await count()).toBeGreaterThan(0), {
      timeout: 15_000,
      interval: 1_000,
    });
    expect(await prisma.clusterSample.findFirst()).toMatchObject({ botId: BOT_ID, clusterId: 0 });

    await call("/clusters/0/stop", { method: "POST" });
    await MetricsService.sync();
    const stored = await count();
    await sleep(2_500);

    expect(await count()).toBe(stored);
  });
});
