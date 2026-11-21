import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Alert } from "#prisma/client";
import AlertRepository from "#repositories/alert.repository";
import BotRepository from "#repositories/bot.repository";
import ClusterRepository from "#repositories/cluster.repository";
import type { DockerEvent, DockerEventAction } from "#schemas/docker.schema";
import AlertService from "#services/alert.service";
import ClusterOperationService from "#services/cluster-operation.service";
import DockerService from "#services/docker.service";

vi.mock("#repositories/alert.repository", () => ({
  default: {
    create: vi.fn(),
    findMany: vi.fn(),
    findManyActive: vi.fn(),
    resolve: vi.fn(),
  },
}));

vi.mock("#repositories/bot.repository", () => ({
  default: {
    findFirstId: vi.fn(),
  },
}));

vi.mock("#repositories/cluster.repository", () => ({
  default: {
    findManyWithContainerId: vi.fn(),
  },
}));

vi.mock("#services/docker.service", () => ({
  default: {
    containerStartedAt: vi.fn(),
    containerStates: vi.fn(),
  },
}));

const MINUTE = 60_000;

type GivenCluster = {
  id: number;
  desiredStatus?: "RUNNING" | "STOPPED";
  state?: string;
  startedAt?: Date;
};

let alerts: Alert[];
let day = 0;

function givenClusters(clusters: GivenCluster[]) {
  vi.mocked(ClusterRepository.findManyWithContainerId).mockResolvedValue(
    clusters.map(({ id, desiredStatus = "RUNNING" }) => ({
      id,
      shardIds: [id],
      desiredStatus,
      containerId: `container-${id}`,
    })),
  );
  vi.mocked(DockerService.containerStates).mockResolvedValue(
    new Map(
      clusters.flatMap(({ id, state }) =>
        state === undefined ? [] : [[`container-${id}`, state] as const],
      ),
    ),
  );
  vi.mocked(DockerService.containerStartedAt).mockImplementation((containerId) =>
    Promise.resolve(clusters.find(({ id }) => `container-${id}` === containerId)?.startedAt),
  );
}

function givenAlert(alert: Pick<Alert, "clusterId" | "kind">) {
  alerts.push({
    id: `alert-${alerts.length}`,
    botId: "bot",
    message: "Given",
    startedAt: new Date(),
    resolvedAt: null,
    ...alert,
  });
}

function event(Action: DockerEventAction, clusterId: number, at = Date.now()): DockerEvent {
  return {
    Action,
    Actor: { ID: `container-${clusterId}`, Attributes: { exitCode: "1" } },
    timeNano: at * 1_000_000,
  };
}

const active = () =>
  alerts
    .filter(({ resolvedAt }) => resolvedAt === null)
    .map(({ clusterId, kind }) => ({ clusterId, kind }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 0, ++day));

  alerts = [];
  vi.mocked(BotRepository.findFirstId).mockResolvedValue({ id: "bot" });
  vi.mocked(AlertRepository.create).mockImplementation((data) => {
    const alert = { id: `alert-${alerts.length}`, resolvedAt: null, ...data };
    alerts.push(alert);

    return Promise.resolve(alert);
  });
  vi.mocked(AlertRepository.findManyActive).mockImplementation((_botId, clusterId) =>
    Promise.resolve(
      alerts.filter(
        (alert) =>
          alert.resolvedAt === null && (clusterId === undefined || alert.clusterId === clusterId),
      ),
    ),
  );
  vi.mocked(AlertRepository.resolve).mockImplementation((ids, resolvedAt) => {
    for (const alert of alerts) {
      if (ids.includes(alert.id)) alert.resolvedAt = resolvedAt;
    }

    return Promise.resolve();
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("handle", () => {
  it("raises a stopped alert when a running cluster exits", async () => {
    givenClusters([{ id: 0 }]);

    await AlertService.handle(event("die", 0));

    expect(alerts).toEqual([
      expect.objectContaining({ clusterId: 0, kind: "STOPPED", message: "Exited with code 1" }),
    ]);
  });

  it("raises a stopped alert when the container is removed outside HallMaster", async () => {
    givenClusters([{ id: 0 }]);

    await AlertService.handle(event("destroy", 0));

    expect(alerts).toEqual([
      expect.objectContaining({ kind: "STOPPED", message: "Container removed outside HallMaster" }),
    ]);
  });

  it("ignores the exit of a cluster stopped on purpose", async () => {
    givenClusters([{ id: 0, desiredStatus: "STOPPED" }]);

    await AlertService.handle(event("die", 0));

    expect(alerts).toEqual([]);
  });

  it("ignores the containers that no cluster owns anymore", async () => {
    givenClusters([{ id: 0 }]);

    await AlertService.handle({
      ...event("destroy", 0),
      Actor: { ID: "old", Attributes: { exitCode: "0" } },
    });

    expect(alerts).toEqual([]);
  });

  it("ignores the exits caused by HallMaster operations", async () => {
    givenClusters([{ id: 0 }]);

    let finish = () => {};
    const operation = ClusterOperationService.run(
      [0],
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const during = Date.now();

    await AlertService.handle(event("die", 0));
    vi.advanceTimersByTime(3_000);
    finish();
    await operation;

    await AlertService.handle(event("die", 0, during));
    vi.advanceTimersByTime(500);
    await AlertService.handle(event("die", 0));

    expect(alerts).toEqual([]);

    vi.advanceTimersByTime(10_000);
    await AlertService.handle(event("die", 0));

    expect(active()).toEqual([{ clusterId: 0, kind: "STOPPED" }]);
  });

  it("does not raise the same stopped alert twice", async () => {
    givenClusters([{ id: 0 }]);

    await AlertService.handle(event("die", 0));
    await AlertService.handle(event("destroy", 0));

    expect(active()).toEqual([{ clusterId: 0, kind: "STOPPED" }]);
  });

  it("resolves the stopped alert once the cluster starts again", async () => {
    givenClusters([{ id: 0 }, { id: 1 }]);

    await AlertService.handle(event("die", 0));
    await AlertService.handle(event("die", 1));
    await AlertService.handle(event("start", 0));

    expect(active()).toEqual([{ clusterId: 1, kind: "STOPPED" }]);
    expect(alerts[0]?.resolvedAt).toEqual(new Date());
  });

  it("raises a crash loop alert after three exits within ten minutes", async () => {
    givenClusters([{ id: 0 }]);

    for (let exit = 0; exit < 3; exit++) {
      await AlertService.handle(event("die", 0));
      await AlertService.handle(event("start", 0));
      vi.advanceTimersByTime(4 * MINUTE);
    }

    expect(active()).toEqual([{ clusterId: 0, kind: "CRASH_LOOP" }]);

    await AlertService.handle(event("die", 0));

    expect(active()).toEqual([{ clusterId: 0, kind: "CRASH_LOOP" }]);
  });

  it("does not count the exits older than ten minutes", async () => {
    givenClusters([{ id: 0 }]);

    for (let exit = 0; exit < 3; exit++) {
      await AlertService.handle(event("die", 0));
      await AlertService.handle(event("start", 0));
      vi.advanceTimersByTime(6 * MINUTE);
    }

    expect(alerts.map(({ kind }) => kind)).toEqual(["STOPPED", "STOPPED", "STOPPED"]);
    expect(active()).toEqual([]);
  });

  it("keeps an out of memory alert as an event that is already over", async () => {
    givenClusters([{ id: 0 }]);

    await AlertService.handle(event("oom", 0));

    expect(alerts).toEqual([
      expect.objectContaining({
        kind: "OOM_KILLED",
        startedAt: new Date(),
        resolvedAt: new Date(),
      }),
    ]);
  });
});

describe("reconcile", () => {
  it("raises a stopped alert for a cluster that should run but does not", async () => {
    givenClusters([
      { id: 0, state: "exited" },
      { id: 1 },
      { id: 2, state: "running" },
      { id: 3, state: "restarting" },
      { id: 4, state: "exited", desiredStatus: "STOPPED" },
    ]);

    await AlertService.reconcile();

    expect(alerts).toEqual([
      expect.objectContaining({ clusterId: 0, kind: "STOPPED", message: "Container is exited" }),
      expect.objectContaining({ clusterId: 1, kind: "STOPPED", message: "Container not found" }),
    ]);
  });

  it("keeps the crash loop alone for a cluster that stays down after it", async () => {
    givenClusters([{ id: 0, state: "exited" }]);
    givenAlert({ clusterId: 0, kind: "CRASH_LOOP" });

    await AlertService.reconcile();

    expect(active()).toEqual([{ clusterId: 0, kind: "CRASH_LOOP" }]);
  });

  it("leaves the clusters under a HallMaster operation alone", async () => {
    givenClusters([{ id: 0, state: "exited" }]);

    await ClusterOperationService.run([0], () => AlertService.reconcile());

    expect(alerts).toEqual([]);
  });

  it("resolves the alerts that no longer apply", async () => {
    givenClusters([
      { id: 0, state: "running" },
      { id: 1, state: "exited", desiredStatus: "STOPPED" },
      { id: 2, state: "exited" },
    ]);
    givenAlert({ clusterId: 0, kind: "STOPPED" });
    givenAlert({ clusterId: 1, kind: "STOPPED" });
    givenAlert({ clusterId: 1, kind: "CRASH_LOOP" });
    givenAlert({ clusterId: 2, kind: "STOPPED" });
    givenAlert({ clusterId: 7, kind: "STOPPED" });

    await AlertService.reconcile();

    expect(active()).toEqual([{ clusterId: 2, kind: "STOPPED" }]);
  });

  it("resolves a crash loop once the cluster stayed up for ten minutes", async () => {
    givenClusters([
      { id: 0, state: "running", startedAt: new Date(Date.now() - 11 * MINUTE) },
      { id: 1, state: "running", startedAt: new Date(Date.now() - 2 * MINUTE) },
    ]);
    givenAlert({ clusterId: 0, kind: "CRASH_LOOP" });
    givenAlert({ clusterId: 1, kind: "CRASH_LOOP" });

    await AlertService.reconcile();

    expect(active()).toEqual([{ clusterId: 1, kind: "CRASH_LOOP" }]);
  });

  it("does nothing before a bot is registered", async () => {
    vi.mocked(BotRepository.findFirstId).mockResolvedValue(null);

    await AlertService.reconcile();

    expect(ClusterRepository.findManyWithContainerId).not.toHaveBeenCalled();
  });
});
