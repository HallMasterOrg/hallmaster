import {
  DockerAPIHttpError,
  DockerContainersAPI,
  DockerImagesAPI,
  DockerSocket,
} from "@hallmaster/docker.js";

import { FailedDependancyException } from "#exceptions/http-exceptions";

type MethodParameters<
  C extends abstract new (...args: any[]) => any,
  P extends keyof InstanceType<C>,
> = Parameters<Extract<InstanceType<C>[P], (...args: any[]) => any>>;

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

  public static async pullImage(...options: MethodParameters<typeof DockerImagesAPI, "create">) {
    return this.call(this.images.create(...options));
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
}
