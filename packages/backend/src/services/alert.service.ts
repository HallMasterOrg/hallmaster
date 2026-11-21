import { setTimeout as sleep } from "node:timers/promises";

import type { Alert as AlertRow, Cluster as ClusterRow } from "#prisma/client";
import AlertRepository from "#repositories/alert.repository";
import BotRepository from "#repositories/bot.repository";
import ClusterRepository from "#repositories/cluster.repository";
import type { Alert, AlertKind, AlertsQuery } from "#schemas/alert.schema";
import type { DockerEvent } from "#schemas/docker.schema";

import ClusterOperationService from "./cluster-operation.service";
import DockerService from "./docker.service";

type WatchedCluster = Pick<ClusterRow, "id" | "containerId" | "desiredStatus">;
type ActiveAlert = Pick<AlertRow, "id" | "kind">;

const CRASH_LOOP_EXITS = 3;
const CRASH_LOOP_WINDOW = 10 * 60_000;
const RECONCILE_INTERVAL = 30_000;
const MAX_RECONNECT_DELAY = 30_000;

export default class AlertService {
  private static readonly exits = new Map<ClusterRow["id"], number[]>();
  private static queue: Promise<unknown> = Promise.resolve();

  private static exclusive<T>(task: () => Promise<T>) {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);

    return result;
  }

  private static report(error: unknown) {
    console.error("Alert monitoring failed", error);
  }

  private static toAlert({ startedAt, resolvedAt, ...alert }: Omit<AlertRow, "botId">): Alert {
    return {
      ...alert,
      startedAt: startedAt.toISOString(),
      resolvedAt: resolvedAt?.toISOString() ?? null,
    };
  }

  public static async getAll(query: AlertsQuery): Promise<Alert[]> {
    const bot = await BotRepository.findFirstId();
    if (bot === null) return [];

    const alerts = await AlertRepository.findMany(bot.id, query);

    return alerts.map((alert) => this.toAlert(alert));
  }

  private static recordExit(id: ClusterRow["id"], at: number) {
    const exits = [...(this.exits.get(id) ?? []), at].filter(
      (exit) => at - exit < CRASH_LOOP_WINDOW,
    );
    this.exits.set(id, exits);

    return exits.length;
  }

  private static exitMessage({ Action, Actor }: DockerEvent) {
    if (Action === "destroy") return "Container removed outside HallMaster";

    return `Exited with code ${Actor.Attributes.exitCode}`;
  }

  private static async onExit(
    botId: string,
    cluster: WatchedCluster,
    event: DockerEvent,
    at: Date,
  ) {
    if (cluster.desiredStatus !== "RUNNING") return;
    if (ClusterOperationService.isBusy(cluster.id, at.getTime())) return;

    const active = await AlertRepository.findManyActive(botId, cluster.id);
    const kinds = new Set(active.map(({ kind }) => kind));
    const raise = (kind: AlertKind, message: string) =>
      AlertRepository.create({ botId, clusterId: cluster.id, kind, message, startedAt: at });

    if (
      event.Action === "die" &&
      this.recordExit(cluster.id, at.getTime()) >= CRASH_LOOP_EXITS &&
      !kinds.has("CRASH_LOOP")
    ) {
      await raise(
        "CRASH_LOOP",
        `Exited ${CRASH_LOOP_EXITS} times within ${CRASH_LOOP_WINDOW / 60_000} minutes`,
      );
      return;
    }

    if (kinds.has("STOPPED") || kinds.has("CRASH_LOOP")) return;

    await raise("STOPPED", this.exitMessage(event));
  }

  public static async handle(event: DockerEvent) {
    return this.exclusive(async () => {
      const [bot, clusters] = await Promise.all([
        BotRepository.findFirstId(),
        ClusterRepository.findManyWithContainerId(),
      ]);
      const cluster = clusters.find(({ containerId }) => containerId === event.Actor.ID);
      if (bot === null || cluster === undefined) return;

      const at = new Date(Math.floor(event.timeNano / 1_000_000));

      switch (event.Action) {
        case "oom":
          await AlertRepository.create({
            botId: bot.id,
            clusterId: cluster.id,
            kind: "OOM_KILLED",
            message: "Killed after running out of memory",
            startedAt: at,
            resolvedAt: at,
          });
          return;
        case "start":
        case "restart": {
          const active = await AlertRepository.findManyActive(bot.id, cluster.id);
          await AlertRepository.resolve(
            active.filter(({ kind }) => kind === "STOPPED").map(({ id }) => id),
            at,
          );
          return;
        }
        case "die":
        case "destroy":
          await this.onExit(bot.id, cluster, event, at);
      }
    });
  }

  private static async isSettled(containerId: string, now: Date) {
    const startedAt = await DockerService.containerStartedAt(containerId);

    return startedAt !== undefined && now.getTime() - startedAt.getTime() >= CRASH_LOOP_WINDOW;
  }

  private static async reconcileCluster(
    botId: string,
    cluster: WatchedCluster,
    state: string | undefined,
    active: ActiveAlert[],
    now: Date,
  ) {
    if (cluster.desiredStatus === "STOPPED") return active;

    if (state === "running") {
      const settled =
        active.some(({ kind }) => kind === "CRASH_LOOP") &&
        (await this.isSettled(cluster.containerId, now));

      return active.filter(({ kind }) => kind === "STOPPED" || (settled && kind === "CRASH_LOOP"));
    }

    const stopped =
      state !== "restarting" &&
      !active.some(({ kind }) => kind === "STOPPED" || kind === "CRASH_LOOP") &&
      !ClusterOperationService.isBusy(cluster.id, now.getTime());

    if (stopped) {
      await AlertRepository.create({
        botId,
        clusterId: cluster.id,
        kind: "STOPPED",
        message: state === undefined ? "Container not found" : `Container is ${state}`,
        startedAt: now,
      });
    }

    return [];
  }

  public static async reconcile() {
    return this.exclusive(async () => {
      const bot = await BotRepository.findFirstId();
      if (bot === null) return;

      const [clusters, active] = await Promise.all([
        ClusterRepository.findManyWithContainerId(),
        AlertRepository.findManyActive(bot.id),
      ]);
      const states = await DockerService.containerStates(
        clusters.map(({ containerId }) => containerId),
      );
      const now = new Date();

      const orphans = active.filter(
        ({ clusterId }) => !clusters.some(({ id }) => id === clusterId),
      );
      const settled = await Promise.all(
        clusters.map((cluster) =>
          this.reconcileCluster(
            bot.id,
            cluster,
            states.get(cluster.containerId),
            active.filter(({ clusterId }) => clusterId === cluster.id),
            now,
          ),
        ),
      );

      await AlertRepository.resolve(
        [...orphans, ...settled.flat()].map(({ id }) => id),
        now,
      );
    });
  }

  private static async listen(signal: AbortSignal) {
    let failures = 0;

    while (!signal.aborted) {
      try {
        const events = await DockerService.streamClusterEvents(signal);
        failures = 0;
        await this.reconcile();

        for await (const event of events) {
          await this.handle(event).catch((error: unknown) => this.report(error));
        }
      } catch (error) {
        failures++;
        this.report(error);
      }

      await sleep(Math.min(1_000 * 2 ** failures, MAX_RECONNECT_DELAY), undefined, {
        signal,
      }).catch(() => undefined);
    }
  }

  public static watch() {
    const controller = new AbortController();
    const interval = setInterval(() => {
      this.reconcile().catch((error: unknown) => this.report(error));
    }, RECONCILE_INTERVAL);

    void this.listen(controller.signal);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }
}
