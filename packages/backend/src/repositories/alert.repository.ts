import prisma from "#lib/database";
import type { Alert } from "#prisma/client";

export default class AlertRepository {
  private static readonly DEFAULT_SELECT = {
    id: true,
    clusterId: true,
    kind: true,
    message: true,
    startedAt: true,
    resolvedAt: true,
  } as const;

  public static async create(
    data: Pick<Alert, "botId" | "clusterId" | "kind" | "message" | "startedAt"> &
      Partial<Pick<Alert, "resolvedAt">>,
  ) {
    return prisma.alert.create({ data, select: this.DEFAULT_SELECT });
  }

  public static async findManyActive(botId: Alert["botId"], clusterId?: Alert["clusterId"]) {
    return prisma.alert.findMany({
      where: { botId, clusterId, resolvedAt: null },
      select: this.DEFAULT_SELECT,
    });
  }

  public static async findMany(
    botId: Alert["botId"],
    { active, limit }: { active?: boolean; limit: number },
  ) {
    return prisma.alert.findMany({
      where: {
        botId,
        ...(active === undefined ? {} : { resolvedAt: active ? null : { not: null } }),
      },
      select: this.DEFAULT_SELECT,
      orderBy: [{ resolvedAt: { sort: "desc", nulls: "first" } }, { startedAt: "desc" }],
      take: limit,
    });
  }

  public static async updateMessage(id: Alert["id"], message: Alert["message"]) {
    await prisma.alert.update({ where: { id }, data: { message } });
  }

  public static async resolve(ids: Alert["id"][], resolvedAt: Date) {
    if (ids.length === 0) return;

    await prisma.alert.updateMany({ where: { id: { in: ids } }, data: { resolvedAt } });
  }
}
