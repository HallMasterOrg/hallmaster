import { createInterface } from "node:readline";
import { Transform, type Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";

import {
  DockerAPIHttpError,
  DockerContainersAPI,
  DockerImagesAPI,
  type DockerContainer,
} from "@hallmaster/docker.js";

import { FailedDependancyException, NotFoundException } from "#exceptions/http-exceptions";
import socket from "#lib/docker";
import {
  DockerContainerStatsSchema,
  DockerEventActionSchema,
  DockerEventLineSchema,
  type DockerContainerStats,
  type DockerCpuStats,
} from "#schemas/docker.schema";

type MethodParameters<
  C extends abstract new (...args: any[]) => any,
  P extends keyof InstanceType<C>,
> = Parameters<Extract<InstanceType<C>[P], (...args: any[]) => any>>;

type RegistryImage = {
  serverName: string;
  image: string;
  tag: string;
  username?: string | null;
  password?: string | null;
};

type ContainerState = Pick<DockerContainer["State"], "Status" | "ExitCode"> & {
  Health?: DockerContainer["State"]["Health"];
};

export type Readiness = {
  delayMs: number;
  timeoutMs: number;
};

const READY_POLL_INTERVAL = 1_000;
const UNAUTHORIZED_PULL =
  /unauthorized|authentication required|authorization failed|no basic auth credentials/i;

export default class DockerService {
  private static readonly images = new DockerImagesAPI(socket);
  private static readonly containers = new DockerContainersAPI(socket);

  private static reason(error: DockerAPIHttpError) {
    try {
      return (JSON.parse(error.message) as { message?: string }).message ?? error.message;
    } catch {
      return error.message;
    }
  }

  private static failure(error: unknown) {
    if (!(error instanceof DockerAPIHttpError)) {
      return new FailedDependancyException({
        message: "Docker Engine API returned an unexpected response",
        cause: error,
      });
    }

    return new FailedDependancyException({
      message: `Docker Engine API returned a ${error.status} ${this.reason(error)}`,
      cause: error,
    });
  }

  private static async call<T>(request: Promise<T>): Promise<T>;
  private static async call<T>(
    request: Promise<T>,
    ignoredStatuses: number[],
  ): Promise<T | undefined>;
  private static async call<T>(request: Promise<T>, ignoredStatuses: number[] = []) {
    return request.catch((error: unknown) => {
      if (error instanceof DockerAPIHttpError && ignoredStatuses.includes(error.status)) {
        return undefined;
      }

      throw this.failure(error);
    });
  }

  private static percentage(value: number, total: number) {
    return total > 0 ? (value / total) * 100 : 0;
  }

  private static cpuPercentage(cpu: DockerCpuStats, precpu: DockerCpuStats) {
    const cpuDelta = cpu.cpu_usage.total_usage - precpu.cpu_usage.total_usage;
    const systemDelta = cpu.system_cpu_usage - precpu.system_cpu_usage;
    if (precpu.system_cpu_usage === 0 || cpuDelta <= 0) {
      return 0;
    }

    return this.percentage(cpuDelta, systemDelta) * cpu.online_cpus;
  }

  private static toContainerStats(stats: DockerContainerStats) {
    const memoryUsage = Math.max(
      stats.memory_stats.usage - stats.memory_stats.stats.inactive_file,
      0,
    );

    return {
      cpuPercentage: this.cpuPercentage(stats.cpu_stats, stats.precpu_stats),
      memory: {
        usage: memoryUsage,
        percentage: this.percentage(memoryUsage, stats.memory_stats.limit),
      },
      network: Object.entries(stats.networks).map(([name, network]) => ({
        interface: name,
        transmitted: network.tx_bytes,
        received: network.rx_bytes,
      })),
    };
  }

  private static unexpectedContainerStats(cause: unknown) {
    return new FailedDependancyException({
      message: "Docker Engine API returned unexpected container stats",
      cause,
    });
  }

  private static registryAuth({ serverName, username, password }: RegistryImage) {
    if (!username || !password) {
      return undefined;
    }

    return { serveraddress: serverName, username, password };
  }

  private static familiarReference({ serverName, image, tag }: RegistryImage) {
    if (serverName !== "docker.io") {
      return `${serverName}/${image}:${tag}`;
    }

    return `${image.replace(/^library\//, "")}:${tag}`;
  }

  private static pull(image: RegistryImage) {
    return this.images.create({
      fromImage: `${image.serverName}/${image.image}`,
      tag: image.tag,
      auth: this.registryAuth(image),
    });
  }

  private static pullFailure(image: RegistryImage, error: unknown) {
    if (!(error instanceof DockerAPIHttpError)) {
      return this.failure(error);
    }

    if (error.status === 404) {
      return new NotFoundException({
        message: `Image ${image.serverName}/${image.image}:${image.tag} not found`,
      });
    }

    if (UNAUTHORIZED_PULL.test(error.message)) {
      return new FailedDependancyException({
        message: `Registry ${image.serverName} refused the saved credentials: ${this.reason(error)}`,
        cause: error,
      });
    }

    return this.failure(error);
  }

  private static async hasImage(image: RegistryImage) {
    const images = await this.call(
      this.images.list({ filters: { reference: [this.familiarReference(image)] } }),
    );

    return images.length > 0;
  }

  public static async ensureImage(image: RegistryImage) {
    if (await this.hasImage(image)) {
      return;
    }

    await this.call(this.pull(image));
  }

  public static async pullImage(image: RegistryImage) {
    await this.pull(image).catch((error: unknown) => {
      throw this.pullFailure(image, error);
    });
  }

  public static async containerStates(containerIds: string[]) {
    if (containerIds.length === 0) {
      return new Map<string, string>();
    }

    const containers = await this.call(
      this.containers.list({ all: true, filters: { id: containerIds } }),
    );

    return new Map(containers.map(({ Id, State }) => [Id, State]));
  }

  public static async containerLabels(containerIds: string[]) {
    if (containerIds.length === 0) {
      return new Map<string, Record<string, string>>();
    }

    const containers = await this.call(
      this.containers.list({ all: true, filters: { id: containerIds } }),
    );

    return new Map(containers.map(({ Id, Labels }) => [Id, Labels]));
  }

  public static async containerStartedAt(containerId: string) {
    const container = await this.call(this.containers.get(containerId), [404]);

    return container === undefined ? undefined : new Date(container.State.StartedAt);
  }

  private static async *parseEvents(input: Readable, signal: AbortSignal) {
    for await (const line of createInterface({ input, crlfDelay: Infinity, signal })) {
      const result = DockerEventLineSchema.safeParse(line);
      if (result.success) yield result.data;
    }
  }

  public static async streamClusterEvents(signal: AbortSignal) {
    const response = await this.call(
      socket.streamAPICall("GET", "/events", {
        query: {
          filters: JSON.stringify({
            type: ["container"],
            label: ["dev.hallmaster.cluster"],
            event: DockerEventActionSchema.options,
          }),
        },
      }),
    );

    if (signal.aborted) response.destroy();
    else signal.addEventListener("abort", () => response.destroy(), { once: true });

    return this.parseEvents(response, signal);
  }

  public static async create(...options: MethodParameters<typeof DockerContainersAPI, "create">) {
    const [, name] = options;
    if (name === undefined) {
      return this.call(this.containers.create(...options));
    }

    const created = await this.call(this.containers.create(...options), [409]);
    if (created !== undefined) {
      return created;
    }

    // A container left behind with the same name (e.g. after a crash) blocks the creation
    await this.stopContainer(name);
    await this.removeContainer(name);

    return this.call(this.containers.create(...options));
  }

  public static async startContainer(
    ...options: MethodParameters<typeof DockerContainersAPI, "start">
  ) {
    return this.call(this.containers.start(...options), [304]);
  }

  public static async stopContainer(
    ...options: MethodParameters<typeof DockerContainersAPI, "stop">
  ) {
    return this.call(this.containers.stop(...options), [304, 404]);
  }

  public static async restartContainer(
    ...options: MethodParameters<typeof DockerContainersAPI, "restart">
  ) {
    return this.call(this.containers.restart(...options));
  }

  public static async removeContainer(
    ...options: MethodParameters<typeof DockerContainersAPI, "remove">
  ) {
    return this.call(this.containers.remove(...options), [404]);
  }

  public static async renameContainer(containerId: string, name: string) {
    return this.call(
      socket.apiCall<void>("POST", `/containers/${containerId}/rename`, { query: { name } }),
    );
  }

  public static async findContainerId(nameOrId: string) {
    const container = await this.call(this.containers.get(nameOrId), [404]);

    return container?.Id;
  }

  private static readinessFailure({ Status, ExitCode, Health }: ContainerState) {
    if (Status === "exited" || Status === "dead") {
      return `the container exited with code ${ExitCode}`;
    }

    if (Health?.Status === "unhealthy") {
      const check = Health.Log.at(-1);
      const output = check?.Output.trim() || `its health check exited with code ${check?.ExitCode}`;

      return `the container is unhealthy: ${output}`;
    }

    return null;
  }

  private static isReady({ Status, Health }: ContainerState, elapsedMs: number, delayMs: number) {
    if (Status !== "running") return false;
    if (Health === undefined) return elapsedMs >= delayMs;

    return Health.Status === "healthy";
  }

  public static async waitUntilReady(containerId: string, { delayMs, timeoutMs }: Readiness) {
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;

    for (; Date.now() < deadline; await sleep(READY_POLL_INTERVAL)) {
      const { State } = await this.call(this.containers.get(containerId));
      const failure = this.readinessFailure(State);
      if (failure !== null) {
        throw new FailedDependancyException({ message: failure });
      }

      if (this.isReady(State, Date.now() - startedAt, delayMs)) {
        return;
      }
    }

    throw new FailedDependancyException({
      message: `the container was not ready after ${timeoutMs / 1_000} seconds`,
    });
  }

  public static async containerLogs(
    ...options: MethodParameters<typeof DockerContainersAPI, "logs">
  ) {
    return this.call(this.containers.logs(...options));
  }

  public static async streamContainerLogs(
    containerId: string,
    options: Omit<NonNullable<MethodParameters<typeof DockerContainersAPI, "logs">[1]>, "follow">,
  ) {
    return this.call(this.containers.logs(containerId, { ...options, follow: true }));
  }

  public static async containerStats(containerId: string) {
    const sample = await this.call(
      this.containers.stats(containerId, { stream: false, oneShot: false }),
    );

    const result = DockerContainerStatsSchema.safeParse(sample);
    if (!result.success) {
      throw this.unexpectedContainerStats(result.error);
    }

    return this.toContainerStats(result.data);
  }

  public static async streamContainerStats(containerId: string) {
    const samples = await this.call(this.containers.stats(containerId, { stream: true }));
    const stats = new Transform({
      objectMode: true,
      transform: (sample: unknown, _encoding, callback) => {
        const result = DockerContainerStatsSchema.safeParse(sample);
        if (!result.success) {
          callback(this.unexpectedContainerStats(result.error));
          return;
        }

        if (result.data.precpu_stats.system_cpu_usage === 0) {
          callback();
          return;
        }

        callback(null, this.toContainerStats(result.data));
      },
    });

    samples.pipe(stats);
    samples.on("error", (error) => stats.destroy(error));
    stats.on("close", () => samples.destroy());

    return stats;
  }
}
