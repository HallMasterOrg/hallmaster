import { setTimeout as sleep } from "node:timers/promises";

import {
  FailedDependancyException,
  NotFoundException,
  ValidationException,
} from "#exceptions/http-exceptions";
import type { Alert as AlertRow, AlertWebhook as AlertWebhookRow } from "#prisma/client";
import AlertWebhookRepository from "#repositories/alert-webhook.repository";
import BotRepository from "#repositories/bot.repository";
import {
  WEBHOOK_URL_PATTERN,
  type AlertWebhook,
  type AlertWebhookSettings,
} from "#schemas/alert-webhook.schema";
import { AlertKindSchema, type AlertKind } from "#schemas/alert.schema";
import type { DiscordEmbed, DiscordWebhook, DiscordWebhookMessage } from "#schemas/discord.schema";

import DiscordService from "./discord.service";

type NotifiedAlert = Pick<AlertRow, "clusterId" | "kind" | "message" | "startedAt" | "resolvedAt">;
type SavedWebhook = Omit<AlertWebhookRow, "botId" | "webhookToken">;

const MAX_ATTEMPTS = 5;

const COLORS = {
  down: 0xef4444,
  warning: 0xf59e0b,
  resolved: 0x22c55e,
  test: 0x5865f2,
};

const LABELS: Record<AlertKind, string> = {
  STOPPED: "down",
  CRASH_LOOP: "crash loop",
  OOM_KILLED: "out of memory",
};

const RAISED: Record<AlertKind, { title: (cluster: string) => string; color: number }> = {
  STOPPED: { title: (cluster) => `Cluster ${cluster} is down`, color: COLORS.down },
  CRASH_LOOP: { title: (cluster) => `Cluster ${cluster} is in a crash loop`, color: COLORS.down },
  OOM_KILLED: { title: (cluster) => `Cluster ${cluster} ran out of memory`, color: COLORS.warning },
};

const DEFAULT_WEBHOOK: AlertWebhook = {
  webhookId: null,
  enabled: false,
  content: "",
  kinds: [...AlertKindSchema.options],
  notifyResolved: false,
  lastDeliveredAt: null,
  lastError: null,
};

export default class AlertWebhookService {
  private static queue: Promise<unknown> = Promise.resolve();

  private static toView({ lastDeliveredAt, ...webhook }: SavedWebhook): AlertWebhook {
    return { ...webhook, lastDeliveredAt: lastDeliveredAt?.toISOString() ?? null };
  }

  private static async botId() {
    const bot = await BotRepository.findFirstId();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    return bot.id;
  }

  public static async get(): Promise<AlertWebhook> {
    const webhook = await AlertWebhookRepository.find(await this.botId());

    return webhook === null ? DEFAULT_WEBHOOK : this.toView(webhook);
  }

  private static credentials(url: string) {
    const [, webhookId, webhookToken] = WEBHOOK_URL_PATTERN.exec(url) ?? [];

    return { webhookId, webhookToken };
  }

  public static async update({ url, kinds, ...settings }: AlertWebhookSettings) {
    const botId = await this.botId();
    const saved = await AlertWebhookRepository.find(botId);
    const data = { ...settings, kinds: [...new Set(kinds)] };

    if (saved === null) {
      if (!url) {
        throw new ValidationException([
          { path: "url", message: "Paste the URL of a Discord webhook" },
        ]);
      }

      const created = await AlertWebhookRepository.create(botId, {
        ...data,
        ...this.credentials(url),
      });

      return this.toView(created);
    }

    const credentials = url ? { ...this.credentials(url), lastError: null } : {};

    return this.toView(await AlertWebhookRepository.update(botId, { ...data, ...credentials }));
  }

  public static async remove(): Promise<AlertWebhook> {
    await AlertWebhookRepository.delete(await this.botId());

    return DEFAULT_WEBHOOK;
  }

  public static async test(): Promise<AlertWebhook> {
    const botId = await this.botId();
    const webhook = await AlertWebhookRepository.findWithToken(botId);
    if (webhook === null) throw new NotFoundException({ message: "Alert webhook not found" });

    const delivery = await DiscordService.executeWebhook(
      { id: webhook.webhookId, token: webhook.webhookToken },
      this.message(webhook.content, {
        title: "HallMaster alerts will be posted here",
        description: "This is a test message sent from the dashboard",
        color: COLORS.test,
      }),
    );

    if (delivery.status !== "SENT") {
      await AlertWebhookRepository.recordDelivery(botId, webhook.webhookId, {
        lastError: delivery.reason,
      });
      throw new FailedDependancyException({ message: delivery.reason });
    }

    const lastDeliveredAt = new Date();
    await AlertWebhookRepository.recordDelivery(botId, webhook.webhookId, {
      lastDeliveredAt,
      lastError: null,
    });

    return this.toView({ ...webhook, lastDeliveredAt, lastError: null });
  }

  public static alertRaised(botId: string, alert: NotifiedAlert) {
    this.enqueue(botId, alert, false);
  }

  public static alertResolved(botId: string, alert: NotifiedAlert) {
    this.enqueue(botId, alert, true);
  }

  public static idle() {
    return this.queue;
  }

  private static enqueue(botId: string, alert: NotifiedAlert, resolved: boolean) {
    this.queue = this.queue
      .then(() => this.notify(botId, alert, resolved))
      .catch((error: unknown) => console.error("Alert notification failed", error));
  }

  private static async notify(botId: string, alert: NotifiedAlert, resolved: boolean) {
    const webhook = await AlertWebhookRepository.findWithToken(botId);
    const wanted =
      webhook !== null &&
      webhook.enabled &&
      webhook.kinds.includes(alert.kind) &&
      (!resolved || webhook.notifyResolved);
    if (!wanted) return;

    const message = resolved
      ? this.resolvedMessage(alert)
      : this.message(webhook.content, this.raisedEmbed(alert));

    await this.deliver(botId, { id: webhook.webhookId, token: webhook.webhookToken }, message);
  }

  private static async deliver(
    botId: string,
    webhook: DiscordWebhook,
    message: DiscordWebhookMessage,
  ) {
    for (let attempt = 1; ; attempt++) {
      const delivery = await DiscordService.executeWebhook(webhook, message);

      if (delivery.status === "SENT") {
        await AlertWebhookRepository.recordDelivery(botId, webhook.id, {
          lastDeliveredAt: new Date(),
          lastError: null,
        });
        return;
      }

      if (delivery.status === "REFUSED" || attempt === MAX_ATTEMPTS) {
        await AlertWebhookRepository.recordDelivery(botId, webhook.id, {
          lastError: delivery.reason,
        });
        return;
      }

      await sleep(
        delivery.status === "RATE_LIMITED" ? delivery.retryAfterMs : 1_000 * 2 ** attempt,
      );
    }
  }

  private static clusterName(id: number) {
    return String(id).padStart(2, "0");
  }

  private static raisedEmbed(alert: NotifiedAlert): DiscordEmbed {
    const { title, color } = RAISED[alert.kind];

    return {
      title: title(this.clusterName(alert.clusterId)),
      description: alert.message,
      color,
      timestamp: alert.startedAt.toISOString(),
      footer: { text: "HallMaster" },
    };
  }

  private static resolvedMessage(alert: NotifiedAlert): DiscordWebhookMessage {
    const resolvedAt = alert.resolvedAt ?? new Date();

    return {
      embeds: [
        {
          title: `Cluster ${this.clusterName(alert.clusterId)}: ${LABELS[alert.kind]} alert resolved`,
          description: `Lasted ${this.formatDuration(resolvedAt.getTime() - alert.startedAt.getTime())}`,
          color: COLORS.resolved,
          timestamp: resolvedAt.toISOString(),
          footer: { text: "HallMaster" },
        },
      ],
      allowed_mentions: { parse: [] },
    };
  }

  private static message(content: string, embed: DiscordEmbed): DiscordWebhookMessage {
    return {
      ...(content.trim() === "" ? {} : { content }),
      embeds: [embed],
      allowed_mentions: { parse: ["everyone", "users", "roles"] },
    };
  }

  private static formatDuration(milliseconds: number) {
    const minutes = Math.floor(milliseconds / 60_000);
    if (minutes < 1) return "less than a minute";
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
}
