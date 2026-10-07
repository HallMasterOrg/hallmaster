import {
  DockerAPIHttpError,
  DockerContainersAPI,
  DockerImagesAPI,
  DockerSocket,
} from "@hallmaster/docker.js";
import { FailedDependancyException } from "../exceptions/http-exceptions";

type MethodParameters<
  C extends abstract new (...args: any[]) => any,
  P extends keyof InstanceType<C>,
> = Parameters<Extract<InstanceType<C>[P], (...args: any[]) => any>>;

const socket = new DockerSocket();
await socket.init();

export default class DockerService {
  private static readonly images = new DockerImagesAPI(socket);
  private static readonly containers = new DockerContainersAPI(socket);

  public static async pullImage(...options: MethodParameters<typeof DockerImagesAPI, "create">) {
    return this.images.create(...options).catch((error) => {
      if (!(error instanceof DockerAPIHttpError))
        throw new FailedDependancyException({
          message: "Docker Engine API returned an unexpected response",
          cause: error,
        });

      throw new FailedDependancyException({
        message: `Docker Engine API returned a ${error.status} ${error.message}`,
        cause: error,
      });
    });
  }

  public static async create(...options: MethodParameters<typeof DockerContainersAPI, "create">) {
    return this.containers.create(...options).catch((error) => {
      if (!(error instanceof DockerAPIHttpError))
        throw new FailedDependancyException({
          message: "Docker Engine API returned an unexpected response",
          cause: error,
        });

      throw new FailedDependancyException({
        message: `Docker Engine API returned a ${error.status} ${error.message}`,
        cause: error,
      });
    });
  }

  public static async start(...options: MethodParameters<typeof DockerContainersAPI, "start">) {
    return this.containers.start(...options).catch((error) => {
      if (!(error instanceof DockerAPIHttpError))
        throw new FailedDependancyException({
          message: "Docker Engine API returned an unexpected response",
          cause: error,
        });

      if (error.status === 304) return;

      throw new FailedDependancyException({
        message: `Docker Engine API returned a ${error.status} ${error.message}`,
        cause: error,
      });
    });
  }

  public static async stop(...options: MethodParameters<typeof DockerContainersAPI, "stop">) {
    return this.containers.stop(...options).catch((error) => {
      if (!(error instanceof DockerAPIHttpError))
        throw new FailedDependancyException({
          message: "Docker Engine API returned an unexpected response",
          cause: error,
        });

      if (error.status === 304) return;

      throw new FailedDependancyException({
        message: `Docker Engine API returned a ${error.status} ${error.message}`,
        cause: error,
      });
    });
  }

  public static async restart(...options: MethodParameters<typeof DockerContainersAPI, "restart">) {
    return this.containers.restart(...options).catch((error) => {
      if (!(error instanceof DockerAPIHttpError))
        throw new FailedDependancyException({
          message: "Docker Engine API returned an unexpected response",
          cause: error,
        });

      throw new FailedDependancyException({
        message: `Docker Engine API returned a ${error.status} ${error.message}`,
        cause: error,
      });
    });
  }

  public static async remove(...options: MethodParameters<typeof DockerContainersAPI, "remove">) {
    return this.containers.remove(...options).catch((error) => {
      if (!(error instanceof DockerAPIHttpError))
        throw new FailedDependancyException({
          message: "Docker Engine API returned an unexpected response",
          cause: error,
        });

      if (error.status === 404) return;

      throw new FailedDependancyException({
        message: `Docker Engine API returned a ${error.status} ${error.message}`,
        cause: error,
      });
    });
  }
}
