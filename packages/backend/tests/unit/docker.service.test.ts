import { Readable } from "node:stream";

import { DockerAPIHttpError } from "@hallmaster/docker.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DockerService from "#services/docker.service";

const { containers, images } = vi.hoisted(() => ({
  containers: {
    list: vi.fn(),
    remove: vi.fn(),
    stats: vi.fn(),
    stop: vi.fn(),
  },
  images: {
    create: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock("@hallmaster/docker.js", () => ({
  DockerAPIHttpError: class extends Error {
    constructor(
      public readonly status: number,
      public readonly reason?: string,
    ) {
      super(reason);
    }
  },
  DockerSocket: class {
    async init() {}
  },
  DockerContainersAPI: class {
    constructor() {
      return containers;
    }
  },
  DockerImagesAPI: class {
    constructor() {
      return images;
    }
  },
}));

function statsSample(overrides: { precpuSystem?: number } = {}) {
  return {
    cpu_stats: {
      cpu_usage: { total_usage: 400 },
      system_cpu_usage: 2000,
      online_cpus: 2,
    },
    precpu_stats: {
      cpu_usage: { total_usage: 200 },
      system_cpu_usage: overrides.precpuSystem ?? 1000,
      online_cpus: 2,
    },
    memory_stats: { usage: 1000, limit: 1600, stats: { inactive_file: 200 } },
    networks: { eth0: { rx_bytes: 10, tx_bytes: 20 } },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("container stats", () => {
  it("computes cpu, memory and network usage", async () => {
    containers.stats.mockResolvedValue(statsSample());

    expect(await DockerService.containerStats("container")).toEqual({
      cpuPercentage: 40,
      memory: { usage: 800, percentage: 50 },
      network: [{ interface: "eth0", transmitted: 20, received: 10 }],
    });
  });

  it("reports no cpu usage without a previous sample", async () => {
    containers.stats.mockResolvedValue(statsSample({ precpuSystem: 0 }));

    expect((await DockerService.containerStats("container")).cpuPercentage).toBe(0);
  });

  it("accepts the empty stats of a stopped container", async () => {
    containers.stats.mockResolvedValue({ memory_stats: {}, cpu_stats: {}, precpu_stats: {} });

    expect(await DockerService.containerStats("container")).toEqual({
      cpuPercentage: 0,
      memory: { usage: 0, percentage: 0 },
      network: [],
    });
  });

  it("rejects malformed stats", async () => {
    containers.stats.mockResolvedValue({ memory_stats: { usage: "a lot" } });

    await expect(DockerService.containerStats("container")).rejects.toMatchObject({
      status: 424,
    });
  });

  it("skips the first streamed sample, which has no previous cpu sample", async () => {
    containers.stats.mockResolvedValue(
      Readable.from([statsSample({ precpuSystem: 0 }), statsSample()]),
    );

    const stats = await (await DockerService.streamContainerStats("container")).toArray();

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ cpuPercentage: 40 });
  });
});

describe("docker engine errors", () => {
  it.each([304, 404])("treats a %i on stop as already stopped", async (status) => {
    containers.stop.mockRejectedValue(new DockerAPIHttpError(status));

    await expect(DockerService.stopContainer("container")).resolves.toBeUndefined();
  });

  it("reports other docker errors as a failed dependency", async () => {
    containers.stop.mockRejectedValue(new DockerAPIHttpError(500, "boom"));

    await expect(DockerService.stopContainer("container")).rejects.toMatchObject({
      status: 424,
      message: "Docker Engine API returned a 500 boom",
    });
  });

  it("reports unexpected failures as a failed dependency", async () => {
    containers.remove.mockRejectedValue(new Error("socket hang up"));

    await expect(DockerService.removeContainer("container")).rejects.toMatchObject({
      status: 424,
    });
  });
});

describe("image availability", () => {
  const image = { serverName: "docker.io", image: "library/alpine", tag: "3.20" };

  it("does not pull an image that is already present", async () => {
    images.list.mockResolvedValue([{ Id: "sha256:abc" }]);

    await DockerService.ensureImage(image);

    expect(images.list).toHaveBeenCalledWith({ filters: { reference: ["alpine:3.20"] } });
    expect(images.create).not.toHaveBeenCalled();
  });

  it("pulls a missing image with the registry credentials", async () => {
    images.list.mockResolvedValue([]);
    images.create.mockResolvedValue(undefined);

    await DockerService.ensureImage({
      serverName: "registry.example.com",
      image: "bot",
      tag: "1.0",
      username: "deployer",
      password: "secret",
    });

    expect(images.list).toHaveBeenCalledWith({
      filters: { reference: ["registry.example.com/bot:1.0"] },
    });
    expect(images.create).toHaveBeenCalledWith({
      fromImage: "registry.example.com/bot",
      tag: "1.0",
      auth: { serveraddress: "registry.example.com", username: "deployer", password: "secret" },
    });
  });
});
