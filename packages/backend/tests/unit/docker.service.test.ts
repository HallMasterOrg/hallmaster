import { once } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";

import { DockerAPIHttpError } from "@hallmaster/docker.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DockerService from "#services/docker.service";

const { containers, images, streamAPICall } = vi.hoisted(() => ({
  containers: {
    create: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
    stats: vi.fn(),
    stop: vi.fn(),
  },
  images: {
    create: vi.fn(),
    list: vi.fn(),
  },
  streamAPICall: vi.fn(),
}));

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn() }));

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
    streamAPICall = streamAPICall;
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

  it("ends the stream with a failed dependency on a malformed sample", async () => {
    containers.stats.mockResolvedValue(
      Readable.from([statsSample(), { memory_stats: { usage: "a lot" } }]),
    );

    const stats = await DockerService.streamContainerStats("container");

    await expect(stats.toArray()).rejects.toMatchObject({ status: 424 });
  });

  it("closes the stats stream when Docker drops it", async () => {
    const samples = new PassThrough({ objectMode: true });
    containers.stats.mockResolvedValue(samples);

    const stats = await DockerService.streamContainerStats("container");
    const failure = once(stats, "error");
    samples.destroy(new Error("socket hang up"));

    const [error] = await failure;
    expect(error).toMatchObject({ message: "socket hang up" });
    expect(stats.destroyed).toBe(true);
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

describe("container creation", () => {
  it("replaces a container left behind with the same name", async () => {
    containers.create
      .mockRejectedValueOnce(new DockerAPIHttpError(409, "name already in use"))
      .mockResolvedValueOnce({ Id: "new-container", Warnings: [] });
    containers.stop.mockResolvedValue(undefined);
    containers.remove.mockResolvedValue(undefined);

    await expect(DockerService.create({ Image: "bot" }, "42-0")).resolves.toMatchObject({
      Id: "new-container",
    });
    expect(containers.stop).toHaveBeenCalledWith("42-0");
    expect(containers.remove).toHaveBeenCalledWith("42-0");
    expect(containers.create).toHaveBeenCalledTimes(2);
  });

  it("reports a conflict on an unnamed container as a failed dependency", async () => {
    containers.create.mockRejectedValue(new DockerAPIHttpError(409, "conflict"));

    await expect(DockerService.create({ Image: "bot" })).rejects.toMatchObject({ status: 424 });
    expect(containers.remove).not.toHaveBeenCalled();
  });
});

describe("image availability", () => {
  it("pulls without credentials when the password is missing", async () => {
    images.list.mockResolvedValue([]);
    images.create.mockResolvedValue(undefined);

    await DockerService.ensureImage({
      serverName: "registry.example.com",
      image: "bot",
      tag: "1.0",
      username: "deployer",
    });

    expect(images.create).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
  });

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

describe("cluster events", () => {
  it("streams the valid events of the HallMaster containers", async () => {
    const lines = [
      JSON.stringify({
        Action: "die",
        Actor: { ID: "a", Attributes: { exitCode: "1" } },
        timeNano: 1,
      }),
      "not json",
      JSON.stringify({ Action: "exec_start", Actor: { ID: "a" }, timeNano: 2 }),
      JSON.stringify({ Action: "start", Actor: { ID: "a", Attributes: {} }, timeNano: 3 }),
    ];
    streamAPICall.mockResolvedValue(Readable.from([`${lines.join("\n")}\n`]));

    const events = [];
    for await (const event of await DockerService.streamClusterEvents(
      new AbortController().signal,
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { Action: "die", Actor: { ID: "a", Attributes: { exitCode: "1" } }, timeNano: 1 },
      { Action: "start", Actor: { ID: "a", Attributes: { exitCode: "unknown" } }, timeNano: 3 },
    ]);
    expect(streamAPICall).toHaveBeenCalledWith("GET", "/events", {
      query: {
        filters: JSON.stringify({
          type: ["container"],
          label: ["dev.hallmaster.cluster"],
          event: ["die", "start", "restart", "oom", "destroy"],
        }),
      },
    });
  });

  it("closes the events stream once aborted", async () => {
    const response = new PassThrough();
    streamAPICall.mockResolvedValue(response);
    const controller = new AbortController();

    const events = (await DockerService.streamClusterEvents(controller.signal))[
      Symbol.asyncIterator
    ]();
    const next = events.next();
    controller.abort();

    await expect(next).resolves.toEqual({ done: true, value: undefined });
    expect(response.destroyed).toBe(true);
  });
});

describe("deployment pull", () => {
  const image = {
    serverName: "registry.example.com:5000",
    image: "bot",
    tag: "2.0",
    username: "ci",
    password: "secret",
  };

  function dockerError(status: number, message: string) {
    return new DockerAPIHttpError(status, JSON.stringify({ message }));
  }

  it("pulls with the registry credentials", async () => {
    images.create.mockResolvedValue(undefined);

    await DockerService.pullImage(image);

    expect(images.create).toHaveBeenCalledWith({
      fromImage: "registry.example.com:5000/bot",
      tag: "2.0",
      auth: { serveraddress: "registry.example.com:5000", username: "ci", password: "secret" },
    });
  });

  it("reports a missing tag as not found", async () => {
    images.create.mockRejectedValue(
      dockerError(404, "registry.example.com:5000/bot:2.0: not found"),
    );

    await expect(DockerService.pullImage(image)).rejects.toMatchObject({
      status: 404,
      message: "Image registry.example.com:5000/bot:2.0 not found",
    });
  });

  it.each([
    "unexpected status from HEAD request to http://registry.example.com:5000/v2/bot/manifests/2.0: 401 Unauthorized",
    "pull access denied, repository does not exist or may require authorization: authorization failed: no basic auth credentials",
    'Get "https://registry.example.com:5000/v2/": unauthorized: authentication required',
  ])("reports a refused authentication as a failed dependency: %s", async (reason) => {
    images.create.mockRejectedValue(dockerError(500, reason));

    await expect(DockerService.pullImage(image)).rejects.toMatchObject({
      status: 424,
      message: `Registry registry.example.com:5000 refused the saved credentials: ${reason}`,
    });
  });

  it("reports other failures with the reason given by Docker", async () => {
    images.create.mockRejectedValue(dockerError(500, "dial tcp: i/o timeout"));

    await expect(DockerService.pullImage(image)).rejects.toMatchObject({
      status: 424,
      message: "Docker Engine API returned a 500 dial tcp: i/o timeout",
    });
  });
});

describe("container lookup", () => {
  it("finds a container by name", async () => {
    containers.get.mockResolvedValue({ Id: "abc" });

    await expect(DockerService.findContainerId("bot-0")).resolves.toBe("abc");
  });

  it("tells when no container has the name", async () => {
    containers.get.mockRejectedValue(new DockerAPIHttpError(404, "No such container"));

    await expect(DockerService.findContainerId("bot-0-previous")).resolves.toBeUndefined();
  });
});

describe("container readiness", () => {
  const readiness = { delayMs: 10_000, timeoutMs: 300_000 };

  function state(Status: string, health?: { Status: string; Output?: string; ExitCode?: number }) {
    return {
      State: {
        Status,
        ExitCode: 3,
        Health: health && {
          Status: health.Status,
          Log: [{ Output: health.Output ?? "", ExitCode: health.ExitCode ?? 1 }],
        },
      },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.mocked(sleep).mockImplementation((delay?: number) => {
      vi.setSystemTime(Date.now() + (delay ?? 0));
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits until the health check of the container passes", async () => {
    containers.get
      .mockResolvedValueOnce(state("running", { Status: "starting" }))
      .mockResolvedValueOnce(state("running", { Status: "healthy" }));

    await expect(DockerService.waitUntilReady("next", readiness)).resolves.toBeUndefined();
    expect(containers.get).toHaveBeenCalledTimes(2);
  });

  it("is ready once a container without health check has run for the delay", async () => {
    containers.get.mockResolvedValue(state("running"));

    await expect(DockerService.waitUntilReady("next", readiness)).resolves.toBeUndefined();
    expect(containers.get).toHaveBeenCalledTimes(11);
  });

  it("fails a container without health check that exits within the delay", async () => {
    containers.get
      .mockResolvedValueOnce(state("running"))
      .mockResolvedValueOnce(state("running"))
      .mockResolvedValue(state("exited"));

    await expect(DockerService.waitUntilReady("next", readiness)).rejects.toMatchObject({
      status: 424,
      message: "the container exited with code 3",
    });
  });

  it.each([
    ["exits", state("exited"), "the container exited with code 3"],
    [
      "turns unhealthy",
      state("running", { Status: "unhealthy", Output: "shards not ready\n" }),
      "the container is unhealthy: shards not ready",
    ],
    [
      "turns unhealthy without output",
      state("running", { Status: "unhealthy", ExitCode: 1 }),
      "the container is unhealthy: its health check exited with code 1",
    ],
  ])("fails when the container %s", async (_case, inspected, message) => {
    containers.get.mockResolvedValue(inspected);

    await expect(DockerService.waitUntilReady("next", readiness)).rejects.toMatchObject({
      status: 424,
      message,
    });
  });

  it("gives up after the timeout", async () => {
    containers.get.mockResolvedValue(state("running", { Status: "starting" }));

    await expect(DockerService.waitUntilReady("next", readiness)).rejects.toMatchObject({
      status: 424,
      message: "the container was not ready after 300 seconds",
    });
    expect(containers.get).toHaveBeenCalledTimes(300);
  });
});
