import prisma from "#lib/database";
import type { Bot } from "#prisma/client";

export default class BotRepository {
  private static readonly DEFAULT_SELECT = {
    id: true,
    totalShards: true,
  } as const;

  static async count() {
    return prisma.bot.count();
  }

  public static async create(data: Omit<Bot, "totalShards">) {
    return prisma.bot.create({
      data: {
        ...data,
        totalShards: 0,
      },
      select: this.DEFAULT_SELECT,
    });
  }

  public static async delete() {
    const bot = await this.findFirstId();
    if (bot === null) return null;

    return prisma.bot.delete({ where: { id: bot.id }, select: this.DEFAULT_SELECT });
  }

  public static async findFirst() {
    return prisma.bot.findFirst({ select: this.DEFAULT_SELECT });
  }

  public static async findFirstId() {
    return prisma.bot.findFirst({ select: { id: true } });
  }

  public static async findFirstIdContainerImageTotalShardsAndToken() {
    return prisma.bot.findFirst({
      select: {
        id: true,
        token: true,
        totalShards: true,
        containerImage: {
          select: { image: true, tag: true, serverName: true, username: true, password: true },
        },
      },
    });
  }

  public static async findFirstToken() {
    return prisma.bot.findFirst({ select: { token: true } });
  }

  public static async findFirstIdAndToken() {
    return prisma.bot.findFirst({ select: { id: true, token: true } });
  }

  public static async findFirstClusters() {
    return prisma.bot.findFirst({
      select: { clusters: { select: { id: true, status: true, shardIds: true } } },
    });
  }

  public static async updateToken(data: Pick<Bot, "token">) {
    const bot = await this.findFirstId();
    if (bot === null) return null;

    return prisma.bot.update({
      data,
      where: {
        id: bot.id,
      },
      select: this.DEFAULT_SELECT,
    });
  }

  // public static async createClusters(data: Pick<Cluster, "id" | "status" | "shardIds">[]) {
  //   const bot = await this.findFirstId();
  //   if (bot === null) return null;

  //   const { clusters } = await prisma.bot.update({
  //     data: {
  //       totalShards: data.flatMap(({ shardIds }) => shardIds).length,
  //       clusters: {
  //         createMany: {
  //           data,
  //         },
  //       },
  //     },
  //     where: {
  //       id: bot.id,
  //     },
  //     select: {
  //       clusters: {
  //         select: {
  //           id: true,
  //           status: true,
  //           shardIds: true,
  //         },
  //       },
  //     },
  //   });

  //   return clusters;
  // }
}
