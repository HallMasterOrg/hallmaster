import { HTTPException } from "hono/http-exception";

import prisma from "#lib/database";
import type { ContainerImage } from "#prisma/client";

import BotRepository from "./bot.repository";

export default class ContainerImageRepository {
  private static readonly DEFAULT_SELECT = {
    serverName: true,
    image: true,
    tag: true,
    username: true,
    password: true,
  } as const;

  public static async count() {
    return prisma.containerImage.count();
  }

  public static async create(
    data: Pick<ContainerImage, "image" | "tag" | "serverName" | "username" | "password">,
  ) {
    const bot = await BotRepository.findFirstId();
    if (bot === null) return null;

    if (await this.count())
      throw new HTTPException(409, { message: "A container image is already registered" });

    return prisma.containerImage.create({
      data: {
        ...data,
        botId: bot.id,
      },
      select: {
        image: true,
        serverName: true,
        tag: true,
        username: true,
      },
    });
  }

  public static async findFirst() {
    return prisma.containerImage.findFirst({
      select: this.DEFAULT_SELECT,
    });
  }

  public static async findFirstId() {
    return prisma.containerImage.findFirst({ select: { id: true } });
  }

  public static async update(
    data: Pick<ContainerImage, "image" | "tag" | "serverName" | "username" | "password">,
  ) {
    const containerImage = await this.findFirstId();
    if (containerImage === null) return null;

    return prisma.containerImage.update({
      data,
      where: {
        id: containerImage.id,
      },
      select: this.DEFAULT_SELECT,
    });
  }
}
