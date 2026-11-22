import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import AlertService from "#services/alert.service";

import {
  createBot,
  register,
  removeContainerOutsideHallMaster,
  request,
  resetState,
  stopContainerOutsideHallMaster,
} from "./helpers";

type Alert = { clusterId: number; kind: string; message: string; resolvedAt: string | null };

let token: string;
let unwatch: () => void;

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await request(path, { ...init, token });

  return { status: response.status, body: (await response.json()) as unknown };
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 1_500));
}

async function alerts(query = "") {
  const { body } = await call(`/alerts${query}`);

  return (body as Alert[]).map(({ clusterId, kind, message, resolvedAt }) => ({
    clusterId,
    kind,
    message,
    active: resolvedAt === null,
  }));
}

beforeAll(() => {
  unwatch = AlertService.watch();
});

afterAll(async () => {
  unwatch();
  await resetState();
});

beforeEach(async () => {
  await resetState();
  token = await register();
  await createBot();

  await call("/bot/container-image", { method: "POST", body: { url: "nginx:alpine" } });
  const { status } = await call("/clusters", {
    method: "PUT",
    body: [{ shardIds: [0] }, { shardIds: [1] }],
  });
  expect(status).toBe(200);

  await settle();
});

describe("alerts", () => {
  it("raises an alert when a cluster stops outside HallMaster and resolves it once started", async () => {
    await stopContainerOutsideHallMaster(1);

    await expect
      .poll(() => alerts("?active=true"), { timeout: 10_000 })
      .toEqual([{ clusterId: 1, kind: "STOPPED", message: "Exited with code 0", active: true }]);

    await call("/clusters/1/start", { method: "POST" });

    await expect
      .poll(() => alerts(), { timeout: 10_000 })
      .toEqual([{ clusterId: 1, kind: "STOPPED", message: "Exited with code 0", active: false }]);
  });

  it("raises an alert when a cluster container is removed outside HallMaster", async () => {
    await removeContainerOutsideHallMaster(0);

    await expect
      .poll(() => alerts("?active=true"), { timeout: 10_000 })
      .toEqual([
        {
          clusterId: 0,
          kind: "STOPPED",
          message: "Container removed outside HallMaster",
          active: true,
        },
      ]);
  });

  it("stays quiet while HallMaster stops, restarts and recreates the clusters", async () => {
    await call("/clusters/0/stop", { method: "POST" });
    await call("/clusters/1/restart", { method: "POST" });
    await call("/clusters", { method: "PUT", body: [{ id: 0, shardIds: [0, 1] }] });
    await settle();
    await AlertService.reconcile();

    expect(await alerts()).toEqual([]);
  });

  it("filters the resolved alerts out", async () => {
    await stopContainerOutsideHallMaster(0);
    await expect.poll(() => alerts("?active=true"), { timeout: 10_000 }).toHaveLength(1);

    await call("/clusters/0/start", { method: "POST" });

    await expect.poll(() => alerts("?active=true"), { timeout: 10_000 }).toEqual([]);
    expect(await alerts("?active=false")).toHaveLength(1);
  });

  it("refuses a visitor without a session", async () => {
    const response = await request("/alerts");

    expect(response.status).toBe(401);
  });
});
