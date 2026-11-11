import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { socketPaths } = vi.hoisted(() => ({ socketPaths: [] as (string | undefined)[] }));

vi.mock("@hallmaster/docker.js", () => ({
  DockerSocket: class {
    constructor(path?: string) {
      socketPaths.push(path);
    }

    async init() {}
  },
}));

beforeEach(() => {
  socketPaths.length = 0;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("docker socket", () => {
  it("uses /var/run/docker.sock when DOCKER_HOST is not set", async () => {
    vi.stubEnv("DOCKER_HOST", "");

    await import("#lib/docker");

    expect(socketPaths).toEqual(["/var/run/docker.sock"]);
  });

  it("reads the socket path from a unix DOCKER_HOST", async () => {
    vi.stubEnv("DOCKER_HOST", "unix:///Users/me/.docker/run/docker.sock");

    await import("#lib/docker");

    expect(socketPaths).toEqual(["/Users/me/.docker/run/docker.sock"]);
  });

  it("refuses a DOCKER_HOST that is not a unix socket", async () => {
    vi.stubEnv("DOCKER_HOST", "tcp://localhost:2375");

    await expect(import("#lib/docker")).rejects.toThrow(
      'Unsupported DOCKER_HOST "tcp://localhost:2375"',
    );
    expect(socketPaths).toEqual([]);
  });
});
