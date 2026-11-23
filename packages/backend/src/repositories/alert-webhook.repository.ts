import prisma from "#lib/database";
import type { AlertWebhook } from "#prisma/client";

type Settings = Pick<AlertWebhook, "enabled" | "content" | "kinds" | "notifyResolved">;
type Credentials = Pick<AlertWebhook, "webhookId" | "webhookToken">;

export default class AlertWebhookRepository {
  private static readonly DEFAULT_SELECT = {
    webhookId: true,
    enabled: true,
    content: true,
    kinds: true,
    notifyResolved: true,
    lastDeliveredAt: true,
    lastError: true,
  } as const;

  public static async find(botId: AlertWebhook["botId"]) {
    return prisma.alertWebhook.findUnique({ where: { botId }, select: this.DEFAULT_SELECT });
  }

  public static async findWithToken(botId: AlertWebhook["botId"]) {
    return prisma.alertWebhook.findUnique({
      where: { botId },
      select: { ...this.DEFAULT_SELECT, webhookToken: true },
    });
  }

  public static async create(botId: AlertWebhook["botId"], data: Settings & Credentials) {
    return prisma.alertWebhook.create({ data: { botId, ...data }, select: this.DEFAULT_SELECT });
  }

  public static async update(
    botId: AlertWebhook["botId"],
    data: Settings & Partial<Credentials> & Partial<Pick<AlertWebhook, "lastError">>,
  ) {
    return prisma.alertWebhook.update({ where: { botId }, data, select: this.DEFAULT_SELECT });
  }

  public static async recordDelivery(
    botId: AlertWebhook["botId"],
    webhookId: AlertWebhook["webhookId"],
    delivery: Pick<AlertWebhook, "lastError"> & Partial<Pick<AlertWebhook, "lastDeliveredAt">>,
  ) {
    await prisma.alertWebhook.updateMany({ where: { botId, webhookId }, data: delivery });
  }

  public static async delete(botId: AlertWebhook["botId"]) {
    await prisma.alertWebhook.deleteMany({ where: { botId } });
  }
}
