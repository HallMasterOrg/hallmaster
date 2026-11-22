import { randomUUID } from "node:crypto";

import { ConflictException, NotFoundException } from "#exceptions/http-exceptions";
import ContainerImageRepository from "#repositories/container-image.repository";
import type { Deployment, DeployWebhook } from "#schemas/webhook.schema";

import ClusterService, { type RolloutOutcome } from "./cluster.service";
import DockerService from "./docker.service";

const KEPT_DEPLOYMENTS = 20;

export default class DeploymentService {
  private static readonly deployments = new Map<Deployment["id"], Deployment>();

  private static remember(deployment: Deployment) {
    this.deployments.set(deployment.id, deployment);

    for (const [id, { status }] of this.deployments) {
      if (this.deployments.size <= KEPT_DEPLOYMENTS) break;
      if (status !== "RUNNING") this.deployments.delete(id);
    }
  }

  private static finish(id: Deployment["id"], { failure }: RolloutOutcome) {
    const deployment = this.deployments.get(id);
    if (deployment === undefined) return;

    this.deployments.set(id, {
      ...deployment,
      status: failure === null ? "SUCCEEDED" : "FAILED",
      message: failure,
      finishedAt: new Date().toISOString(),
    });
  }

  public static async deploy({ tag }: DeployWebhook): Promise<Deployment> {
    const containerImage = await ContainerImageRepository.findFirst();
    if (containerImage === null) {
      throw new ConflictException({
        message: "No container image is registered, finish the setup in the dashboard first",
      });
    }

    await DockerService.pullImage({ ...containerImage, tag });
    const { finished } = await ClusterService.redeploy(tag);

    const deployment: Deployment = {
      id: randomUUID(),
      image: `${containerImage.serverName}/${containerImage.image}:${tag}`,
      status: "RUNNING",
      message: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    this.remember(deployment);

    void finished.then(
      (outcome) => this.finish(deployment.id, outcome),
      (error: unknown) =>
        this.finish(deployment.id, {
          failure: error instanceof Error ? error.message : String(error),
        }),
    );

    return deployment;
  }

  public static get(id: Deployment["id"]) {
    const deployment = this.deployments.get(id);
    if (deployment === undefined) {
      throw new NotFoundException({ message: `Deployment ${id} not found` });
    }

    return deployment;
  }
}
