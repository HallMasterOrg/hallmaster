import { Transform } from "node:stream";

import {
  DockerAPIHttpError,
  DockerContainersAPI,
  DockerImagesAPI,
  DockerSocket,
} from "@hallmaster/docker.js";

import { FailedDependancyException } from "#exceptions/http-exceptions";
import {
  DockerContainerStatsSchema,
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

const socket = new DockerSocket();
await socket.init();

export default class DockerService {
  private static readonly images = new DockerImagesAPI(socket);
  private static readonly containers = new DockerContainersAPI(socket);

  private static async call<T>(request: Promise<T>): Promise<T>;
  private static async call<T>(
    request: Promise<T>,
    ignoredStatuses: number[],
  ): Promise<T | undefined>;
  private static async call<T>(request: Promise<T>, ignoredStatuses: number[] = []) {
    return request.catch((error: unknown) => {
      if (!(error instanceof DockerAPIHttpError)) {
        throw new FailedDependancyException({
          message: "Docker Engine API returned an unexpected response",
          cause: error,
        });
      }

      if (ignoredStatuses.includes(error.status)) {
        return undefined;
      }

      throw new FailedDependancyException({
        message: `Docker Engine API returned a ${error.status} ${error.message}`,
        cause: error,
      });
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

  private static async pullImage(image: RegistryImage) {
    return this.call(
      this.images.create({
        fromImage: `${image.serverName}/${image.image}`,
        tag: image.tag,
        auth: this.registryAuth(image),
      }),
    );
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

    await this.pullImage(image);
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

  public static async create(...options: MethodParameters<typeof DockerContainersAPI, "create">) {
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
