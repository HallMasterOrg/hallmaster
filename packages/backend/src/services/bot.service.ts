import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "#exceptions/http-exceptions";
import BotRepository from "#repositories/bot.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import EnvironmentVariableRepository from "#repositories/environment-variable.repository";
import type {
  Bot,
  ContainerImage,
  CreateBot,
  WebhookStatus,
  WebhookToken,
} from "#schemas/bot.schema";
import type { Environment } from "#schemas/environment.schema";

import ClusterOperationService from "./cluster-operation.service";
import ClusterService from "./cluster.service";
import DiscordService from "./discord.service";
import DockerService from "./docker.service";

export default class BotService {
  private static parseContainerImage(url: ContainerImage["url"]) {
    const [first, ...rest] = url.trim().split("/");
    const hasRegistry =
      rest.length > 0 && (first.includes(".") || first.includes(":") || first === "localhost");
    const host = hasRegistry ? first : "docker.io";
    const path = hasRegistry ? rest : [first, ...rest];
    const repository = host === "docker.io" && path.length === 1 ? ["library", ...path] : path;
    const [image, tag = "latest"] = repository.join("/").split(":");

    return { host, image, tag };
  }

  public static async create({ token }: CreateBot): Promise<Bot> {
    await DiscordService.getGatewayBot(token);

    const botCount = await BotRepository.count();
    if (botCount !== 0) throw new ConflictException({ message: "A bot is already registered" });

    const { id, totalShards } = await BotRepository.create({
      id: Buffer.from(token.split(".")[0], "base64").toString("ascii"),
      token,
    });

    return {
      id,
      shards: totalShards,
    };
  }

  public static async update({ token }: CreateBot): Promise<Bot> {
    const bot = await BotRepository.findFirstId();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    await DiscordService.getGatewayBot(token);

    const updated = await BotRepository.updateToken({ token });
    if (updated === null) throw new NotFoundException({ message: "Bot not found" });

    return {
      id: updated.id,
      shards: updated.totalShards,
    };
  }

  public static async get(): Promise<Bot> {
    const bot = await BotRepository.findFirst();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return {
      id: bot.id,
      shards: bot.totalShards,
    };
  }

  public static async delete(): Promise<Bot> {
    const bot = await BotRepository.findFirstId();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    const deleted = await ClusterOperationService.runOnLayout(async () => {
      await ClusterService.stopAll();
      await ClusterService.removeAll();

      return BotRepository.delete();
    });
    if (deleted === null) throw new NotFoundException({ message: "Bot not found" });

    return {
      id: deleted.id,
      shards: deleted.totalShards,
    };
  }

  public static async recommendedShards() {
    const bot = await BotRepository.findFirstToken();
    if (bot === null) {
      throw new NotFoundException({ message: "Bot not found" });
    }

    const { shards } = await DiscordService.getGatewayBot(bot.token);

    return { shards };
  }

  public static async discordProfile() {
    const bot = await BotRepository.findFirstToken();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return DiscordService.getBotProfile(bot.token);
  }

  public static async getEnvironment(): Promise<Environment> {
    const bot = await BotRepository.findFirstId();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return { variables: await EnvironmentVariableRepository.findMany() };
  }

  public static async updateEnvironment({ variables }: Environment): Promise<Environment> {
    const bot = await BotRepository.findFirstId();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return { variables: await EnvironmentVariableRepository.replaceAll(bot.id, variables) };
  }

  public static async createContainerImage({
    url,
    username,
    password,
  }: ContainerImage): Promise<Omit<ContainerImage, "password">> {
    const { host, image, tag } = this.parseContainerImage(url);

    await DockerService.ensureImage({ serverName: host, image, tag, username, password });

    const containerImage = await ContainerImageRepository.create({
      image,
      tag,
      serverName: host,
      username: username ?? null,
      password: password ?? null,
    });

    if (containerImage === null) throw new NotFoundException({ message: "Bot not found" });

    return {
      url: `${containerImage.serverName}/${containerImage.image}:${containerImage.tag}`,
      username: containerImage.username ?? undefined,
    };
  }

  public static async getContainerImage() {
    const containerImage = await ContainerImageRepository.findFirst();
    if (containerImage === null)
      throw new NotFoundException({ message: "Container image not found" });

    return {
      url: `${containerImage.serverName}/${containerImage.image}:${containerImage.tag}`,
      username: containerImage.username ?? undefined,
    };
  }

  public static async updateContainerImage({
    url,
    username,
    password,
  }: ContainerImage): Promise<Omit<ContainerImage, "password">> {
    const current = await ContainerImageRepository.findFirst();
    if (current === null) {
      throw new NotFoundException({ message: "Container image not found" });
    }

    const { host, image, tag } = this.parseContainerImage(url);
    const keepsCredentials = current.serverName === host && current.username === (username ?? null);
    const credentials = {
      username: username ?? null,
      password: password ?? (keepsCredentials ? current.password : null),
    };

    await DockerService.ensureImage({ serverName: host, image, tag, ...credentials });

    const containerImage = await ContainerImageRepository.update({
      image,
      tag,
      serverName: host,
      ...credentials,
    });

    if (containerImage === null)
      throw new NotFoundException({ message: "Container image not found" });

    return {
      url: `${containerImage.serverName}/${containerImage.image}:${containerImage.tag}`,
      username: containerImage.username ?? undefined,
    };
  }

  private static hash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  public static async getWebhook(): Promise<WebhookStatus> {
    const bot = await BotRepository.findFirstWebhookTokenHash();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return { enabled: bot.webhookTokenHash !== null };
  }

  public static async regenerateWebhookToken(): Promise<WebhookToken> {
    const token = randomBytes(32).toString("base64url");
    const bot = await BotRepository.updateWebhookTokenHash({ webhookTokenHash: this.hash(token) });
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return { token };
  }

  public static async authorizeWebhook(token: string | undefined) {
    const bot = await BotRepository.findFirstWebhookTokenHash();
    if (!bot?.webhookTokenHash) {
      throw new ForbiddenException({
        message: "The webhook is disabled, generate a token in the dashboard settings to enable it",
      });
    }

    if (
      token === undefined ||
      !timingSafeEqual(Buffer.from(this.hash(token)), Buffer.from(bot.webhookTokenHash))
    ) {
      throw new UnauthorizedException({ message: "Invalid webhook token" });
    }
  }
}
