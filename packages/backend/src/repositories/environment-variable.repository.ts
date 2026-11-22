import prisma from "#lib/database";
import type { Bot, EnvironmentVariable } from "#prisma/client";

export default class EnvironmentVariableRepository {
  private static readonly DEFAULT_SELECT = { key: true, value: true } as const;

  public static async findMany() {
    return prisma.environmentVariable.findMany({
      select: this.DEFAULT_SELECT,
      orderBy: { key: "asc" },
    });
  }

  public static async replaceAll(
    botId: Bot["id"],
    variables: Pick<EnvironmentVariable, "key" | "value">[],
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.environmentVariable.deleteMany({ where: { botId } });
      await tx.environmentVariable.createMany({
        data: variables.map((variable) => ({ ...variable, botId })),
      });

      return tx.environmentVariable.findMany({
        where: { botId },
        select: this.DEFAULT_SELECT,
        orderBy: { key: "asc" },
      });
    });
  }
}
