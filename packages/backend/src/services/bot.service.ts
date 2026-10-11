import { ConflictException, NotFoundException } from "#exceptions/http-exceptions";
import BotRepository from "#repositories/bot.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import type { Bot, ContainerImage, CreateBot } from "#schemas/bot.schema";

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

    await ClusterService.stopAll();
    await ClusterService.removeAll();

    const deleted = await BotRepository.delete();
    if (deleted === null) throw new NotFoundException({ message: "Bot not found" });

    return {
      id: deleted.id,
      shards: deleted.totalShards,
    };
  }

  public static async discordProfile() {
    const bot = await BotRepository.findFirstToken();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return DiscordService.getBotProfile(bot.token);
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
}
