import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictException, NotFoundException } from "#exceptions/http-exceptions";
import ContainerImageRepository from "#repositories/container-image.repository";
import ClusterService, { type RolloutOutcome } from "#services/cluster.service";
import DeploymentService from "#services/deployment.service";
import DockerService from "#services/docker.service";

vi.mock("#repositories/container-image.repository", () => ({
  default: { findFirst: vi.fn() },
}));

vi.mock("#services/cluster.service", () => ({
  default: { redeploy: vi.fn() },
}));

vi.mock("#services/docker.service", () => ({
  default: { pullImage: vi.fn() },
}));

const saved = {
  serverName: "registry.example.com:5000",
  image: "bot",
  tag: "1.0",
  username: "ci",
  password: "secret",
};

function rollout() {
  let finish = (_outcome: RolloutOutcome) => {};
  const finished = new Promise<RolloutOutcome>((resolve) => (finish = resolve));
  vi.mocked(ClusterService.redeploy).mockResolvedValue({ clusters: [], finished });

  return finish;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue(saved);
});

describe("deployment", () => {
  it("pulls the tag with the saved credentials, then redeploys with it", async () => {
    rollout();

    const deployment = await DeploymentService.deploy({ tag: "2.0" });

    expect(DockerService.pullImage).toHaveBeenCalledWith({ ...saved, tag: "2.0" });
    expect(ClusterService.redeploy).toHaveBeenCalledWith("2.0");
    expect(deployment).toMatchObject({
      image: "registry.example.com:5000/bot:2.0",
      status: "RUNNING",
      message: null,
      finishedAt: null,
    });
  });

  it.each([
    [{ failure: null }, "SUCCEEDED", null],
    [
      { failure: "Cluster 1 could not run the image" },
      "FAILED",
      "Cluster 1 could not run the image",
    ],
  ])("records how the rollout ended", async (outcome, status, message) => {
    const finish = rollout();
    const { id } = await DeploymentService.deploy({ tag: "2.0" });

    expect(DeploymentService.get(id).status).toBe("RUNNING");
    finish(outcome);

    await vi.waitFor(() =>
      expect(DeploymentService.get(id)).toMatchObject({
        status,
        message,
        finishedAt: expect.any(String),
      }),
    );
  });

  it("refuses to deploy before the setup is finished", async () => {
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue(null);

    await expect(DeploymentService.deploy({ tag: "2.0" })).rejects.toMatchObject({
      status: 409,
      message: "No container image is registered, finish the setup in the dashboard first",
    });
    expect(DockerService.pullImage).not.toHaveBeenCalled();
  });

  it("starts nothing when the tag cannot be pulled", async () => {
    vi.mocked(DockerService.pullImage).mockRejectedValue(
      new NotFoundException({ message: "Image registry.example.com:5000/bot:2.0 not found" }),
    );

    await expect(DeploymentService.deploy({ tag: "2.0" })).rejects.toMatchObject({ status: 404 });
    expect(ClusterService.redeploy).not.toHaveBeenCalled();
  });

  it("passes on the refusal of a busy layout", async () => {
    vi.mocked(ClusterService.redeploy).mockRejectedValue(
      new ConflictException({
        message: "Another operation is running on the clusters, retry once it is done",
      }),
    );

    await expect(DeploymentService.deploy({ tag: "2.0" })).rejects.toMatchObject({ status: 409 });
  });

  it("answers 404 for an unknown deployment", () => {
    expect(() => DeploymentService.get("0b6f6f8e-7c5e-4d55-9a8f-0f4b5a1d2c3e")).toThrow(
      "Deployment 0b6f6f8e-7c5e-4d55-9a8f-0f4b5a1d2c3e not found",
    );
  });

  it("keeps only the last 20 finished deployments", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 22; index++) {
      vi.mocked(ClusterService.redeploy).mockResolvedValue({
        clusters: [],
        finished: Promise.resolve({ failure: null }),
      });
      ids.push((await DeploymentService.deploy({ tag: `${index}` })).id);
      await vi.waitFor(() => expect(DeploymentService.get(ids.at(-1)!).status).toBe("SUCCEEDED"));
    }

    expect(() => DeploymentService.get(ids[0])).toThrow("not found");
    expect(DeploymentService.get(ids[21]).status).toBe("SUCCEEDED");
  });
});
