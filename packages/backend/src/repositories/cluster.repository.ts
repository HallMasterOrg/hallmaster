import prisma from "#lib/database";
import type { Cluster } from "#prisma/client";

export default class ClusterRepository {
  private static readonly DEFAULT_SELECT = {
    id: true,
    shardIds: true,
    status: true,
  } as const;

  public static async findFirstContainerIdById(id: Cluster["id"]) {
    return prisma.cluster.findFirst({
      where: { id },
      select: {
        containerId: true,
      },
    });
  }

  public static async create(
    data: Pick<Cluster, "id" | "status" | "shardIds" | "botId" | "containerId">,
  ) {
    return prisma.cluster.create({
      data,
      select: this.DEFAULT_SELECT,
    });
  }

  public static async findFirstById(id: Cluster["id"]) {
    return prisma.cluster.findFirst({ where: { id }, select: this.DEFAULT_SELECT });
  }

  public static async findFirstBotIdById(id: Cluster["id"]) {
    return prisma.cluster.findFirst({
      where: {
        id,
      },
      select: { botId: true },
    });
  }

  public static async findFirstShardIdsById(id: Cluster["id"]) {
    return prisma.cluster.findFirst({
      where: { id },
      select: { shardIds: true },
    });
  }

  public static async updateStatusById(status: Cluster["status"], id: Cluster["id"]) {
    const cluster = await this.findFirstBotIdById(id);
    if (cluster === null) return null;

    return prisma.cluster.update({
      data: {
        status,
      },
      where: { botId_id: { botId: cluster.botId, id } },
      select: this.DEFAULT_SELECT,
    });
  }

  public static async deleteById(id: Cluster["id"]) {
    const cluster = await this.findFirstBotIdById(id);
    if (cluster === null) return null;

    return prisma.cluster.delete({
      where: { botId_id: { botId: cluster.botId, id } },
      select: this.DEFAULT_SELECT,
    });
  }

  public static async findMany() {
    return prisma.cluster.findMany({
      select: this.DEFAULT_SELECT,
    });
  }

  public static async findManyIdAndContainerId() {
    return prisma.cluster.findMany({ select: { id: true, containerId: true } });
  }

  public static async updateManyStatusById(status: Cluster["status"], ids: Cluster["id"][]) {
    return prisma.cluster.updateMany({
      data: { status },
      where: { id: { in: ids } },
    });
  }

  public static async deleteManyById(ids: Cluster["id"][]) {
    return prisma.cluster.deleteMany({ where: { id: { in: ids } } });
  }
}
