import { setTimeout as sleep } from "node:timers/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Alert, AlertWebhook } from "#prisma/client";
import AlertWebhookRepository from "#repositories/alert-webhook.repository";
import BotRepository from "#repositories/bot.repository";
import type { DiscordWebhookDelivery } from "#schemas/discord.schema";
import AlertWebhookService from "#services/alert-webhook.service";
import DiscordService from "#services/discord.service";

vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn() }));

vi.mock("#repositories/alert-webhook.repository", () => ({
  default: {
    find: vi.fn(),
    findWithToken: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    recordDelivery: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("#repositories/bot.repository", () => ({
  default: { findFirstId: vi.fn() },
}));

vi.mock("#services/discord.service", () => ({
  default: { executeWebhook: vi.fn() },
}));

const WEBHOOK_ID = "1234567890123456789";
const WEBHOOK = { id: WEBHOOK_ID, token: "webhook-token" };
const URL = `https://discord.com/api/webhooks/${WEBHOOK_ID}/webhook-token`;

type SavedWebhook = Omit<AlertWebhook, "botId">;

function saved(webhook: Partial<SavedWebhook> = {}): SavedWebhook {
  return {
    webhookId: WEBHOOK_ID,
    webhookToken: "webhook-token",
    enabled: true,
    content: "@everyone",
    kinds: ["STOPPED", "CRASH_LOOP", "OOM_KILLED"],
    notifyResolved: false,
    lastDeliveredAt: null,
    lastError: null,
    ...webhook,
  };
}

function givenWebhook(webhook: SavedWebhook | null) {
  vi.mocked(AlertWebhookRepository.findWithToken).mockResolvedValue(webhook);
  if (webhook === null) {
    vi.mocked(AlertWebhookRepository.find).mockResolvedValue(null);
    return;
  }

  const { webhookToken: _token, ...view } = webhook;
  vi.mocked(AlertWebhookRepository.find).mockResolvedValue(view);
}

function deliveries(...results: DiscordWebhookDelivery[]) {
  for (const result of results) {
    vi.mocked(DiscordService.executeWebhook).mockResolvedValueOnce(result);
  }
}

function alert(fields: Partial<Alert> = {}) {
  return {
    clusterId: 2,
    kind: "STOPPED" as const,
    message: "Exited with code 1",
    startedAt: new Date("2026-11-23T10:00:00Z"),
    resolvedAt: null,
    ...fields,
  };
}

function sentMessages() {
  return vi.mocked(DiscordService.executeWebhook).mock.calls.map(([, message]) => message);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(BotRepository.findFirstId).mockResolvedValue({ id: "bot" });
  vi.mocked(AlertWebhookRepository.create).mockImplementation((_botId, data) => {
    const { webhookToken: _token, ...view } = saved(data);
    return Promise.resolve(view);
  });
  vi.mocked(AlertWebhookRepository.update).mockImplementation((_botId, data) => {
    const { webhookToken: _token, ...view } = saved(data);
    return Promise.resolve(view);
  });
});

describe("settings", () => {
  it("starts with every alert selected and nothing posted", async () => {
    givenWebhook(null);

    expect(await AlertWebhookService.get()).toEqual({
      webhookId: null,
      enabled: false,
      content: "",
      kinds: ["STOPPED", "CRASH_LOOP", "OOM_KILLED"],
      notifyResolved: false,
      lastDeliveredAt: null,
      lastError: null,
    });
  });

  it("never returns the token of the webhook", async () => {
    givenWebhook(saved({ lastDeliveredAt: new Date("2026-11-23T10:00:00Z") }));

    const webhook = await AlertWebhookService.get();

    expect(webhook).not.toHaveProperty("webhookToken");
    expect(webhook).toMatchObject({
      webhookId: WEBHOOK_ID,
      lastDeliveredAt: "2026-11-23T10:00:00.000Z",
    });
  });

  it("asks for a URL before the first save", async () => {
    givenWebhook(null);

    await expect(
      AlertWebhookService.update({
        enabled: true,
        content: "",
        kinds: ["STOPPED"],
        notifyResolved: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      issues: [{ path: "url", message: "Paste the URL of a Discord webhook" }],
    });
  });

  it("saves the webhook of the URL with the alerts picked once", async () => {
    givenWebhook(null);

    await AlertWebhookService.update({
      url: URL,
      enabled: true,
      content: "<@111111111111111111>",
      kinds: ["STOPPED", "STOPPED", "OOM_KILLED"],
      notifyResolved: true,
    });

    expect(AlertWebhookRepository.create).toHaveBeenCalledWith("bot", {
      webhookId: WEBHOOK_ID,
      webhookToken: "webhook-token",
      enabled: true,
      content: "<@111111111111111111>",
      kinds: ["STOPPED", "OOM_KILLED"],
      notifyResolved: true,
    });
  });

  it("keeps the saved webhook when no URL is given", async () => {
    givenWebhook(saved());

    await AlertWebhookService.update({
      enabled: false,
      content: "",
      kinds: ["STOPPED"],
      notifyResolved: false,
    });

    expect(AlertWebhookRepository.update).toHaveBeenCalledWith("bot", {
      enabled: false,
      content: "",
      kinds: ["STOPPED"],
      notifyResolved: false,
    });
  });

  it("forgets the last error when the URL changes", async () => {
    givenWebhook(saved({ lastError: "Discord does not know this webhook anymore" }));

    await AlertWebhookService.update({
      url: "https://discord.com/api/webhooks/9876543210987654321/new-token",
      enabled: true,
      content: "",
      kinds: ["STOPPED"],
      notifyResolved: false,
    });

    expect(AlertWebhookRepository.update).toHaveBeenCalledWith(
      "bot",
      expect.objectContaining({
        webhookId: "9876543210987654321",
        webhookToken: "new-token",
        lastError: null,
      }),
    );
  });

  it("refuses everything before a bot is registered", async () => {
    vi.mocked(BotRepository.findFirstId).mockResolvedValue(null);

    await expect(AlertWebhookService.get()).rejects.toMatchObject({ status: 404 });
    await expect(AlertWebhookService.remove()).rejects.toMatchObject({ status: 404 });
  });
});

describe("test message", () => {
  it("posts the configured mentions with a test embed", async () => {
    givenWebhook(saved());
    deliveries({ status: "SENT" });

    const webhook = await AlertWebhookService.test();

    expect(DiscordService.executeWebhook).toHaveBeenCalledWith(WEBHOOK, {
      content: "@everyone",
      embeds: [expect.objectContaining({ title: "HallMaster alerts will be posted here" })],
      allowed_mentions: { parse: ["everyone", "users", "roles"] },
    });
    expect(webhook.lastDeliveredAt).toEqual(expect.any(String));
    expect(AlertWebhookRepository.recordDelivery).toHaveBeenCalledWith("bot", WEBHOOK_ID, {
      lastDeliveredAt: expect.any(Date),
      lastError: null,
    });
  });

  it("posts it even while the alerts are turned off", async () => {
    givenWebhook(saved({ enabled: false }));
    deliveries({ status: "SENT" });

    await AlertWebhookService.test();

    expect(DiscordService.executeWebhook).toHaveBeenCalledOnce();
  });

  it("reports why Discord refused it", async () => {
    givenWebhook(saved());
    const reason = "Discord does not know this webhook anymore, paste a new URL";
    deliveries({ status: "REFUSED", reason });

    await expect(AlertWebhookService.test()).rejects.toMatchObject({
      status: 424,
      message: reason,
    });
    expect(AlertWebhookRepository.recordDelivery).toHaveBeenCalledWith("bot", WEBHOOK_ID, {
      lastError: reason,
    });
  });

  it("needs a webhook", async () => {
    givenWebhook(null);

    await expect(AlertWebhookService.test()).rejects.toMatchObject({
      status: 404,
      message: "Alert webhook not found",
    });
  });
});

describe("notifications", () => {
  it("posts a raised alert with the mentions in the content and the details in an embed", async () => {
    givenWebhook(saved());
    deliveries({ status: "SENT" });

    AlertWebhookService.alertRaised("bot", alert());
    await AlertWebhookService.idle();

    expect(sentMessages()).toEqual([
      {
        content: "@everyone",
        embeds: [
          {
            title: "Cluster 02 is down",
            description: "Exited with code 1",
            color: 0xef4444,
            timestamp: "2026-11-23T10:00:00.000Z",
            footer: { text: "HallMaster" },
          },
        ],
        allowed_mentions: { parse: ["everyone", "users", "roles"] },
      },
    ]);
  });

  it("leaves the content out when no mention is configured", async () => {
    givenWebhook(saved({ content: "  " }));
    deliveries({ status: "SENT" });

    AlertWebhookService.alertRaised("bot", alert({ kind: "OOM_KILLED" }));
    await AlertWebhookService.idle();

    expect(sentMessages()[0]).not.toHaveProperty("content");
    expect(sentMessages()[0].embeds[0].title).toBe("Cluster 02 ran out of memory");
  });

  it.each([
    ["no webhook is set", null],
    ["the alerts are turned off", saved({ enabled: false })],
    ["this kind of alert is not picked", saved({ kinds: ["OOM_KILLED"] })],
  ])("posts nothing when %s", async (_case, webhook) => {
    givenWebhook(webhook);

    AlertWebhookService.alertRaised("bot", alert());
    await AlertWebhookService.idle();

    expect(DiscordService.executeWebhook).not.toHaveBeenCalled();
  });

  it("posts a resolved alert without mentions only when asked to", async () => {
    givenWebhook(saved());
    AlertWebhookService.alertResolved(
      "bot",
      alert({ resolvedAt: new Date("2026-11-23T11:05:00Z") }),
    );
    await AlertWebhookService.idle();
    expect(DiscordService.executeWebhook).not.toHaveBeenCalled();

    givenWebhook(saved({ notifyResolved: true }));
    deliveries({ status: "SENT" });
    AlertWebhookService.alertResolved(
      "bot",
      alert({ resolvedAt: new Date("2026-11-23T11:05:00Z") }),
    );
    await AlertWebhookService.idle();

    expect(sentMessages()).toEqual([
      {
        embeds: [
          expect.objectContaining({
            title: "Cluster 02: down alert resolved",
            description: "Lasted 1 h 5 min",
            color: 0x22c55e,
          }),
        ],
        allowed_mentions: { parse: [] },
      },
    ]);
  });

  it("waits as long as Discord asks when it is rate limited", async () => {
    givenWebhook(saved());
    deliveries(
      {
        status: "RATE_LIMITED",
        reason: "Discord is rate limiting the webhook",
        retryAfterMs: 1500,
      },
      { status: "SENT" },
    );

    AlertWebhookService.alertRaised("bot", alert());
    await AlertWebhookService.idle();

    expect(sleep).toHaveBeenCalledWith(1500);
    expect(DiscordService.executeWebhook).toHaveBeenCalledTimes(2);
    expect(AlertWebhookRepository.recordDelivery).toHaveBeenCalledWith("bot", WEBHOOK_ID, {
      lastDeliveredAt: expect.any(Date),
      lastError: null,
    });
  });

  it("gives up after five attempts while Discord is unavailable", async () => {
    givenWebhook(saved());
    vi.mocked(DiscordService.executeWebhook).mockResolvedValue({
      status: "UNAVAILABLE",
      reason: "Discord API is unreachable or timed out",
    });

    AlertWebhookService.alertRaised("bot", alert());
    await AlertWebhookService.idle();

    expect(DiscordService.executeWebhook).toHaveBeenCalledTimes(5);
    expect(vi.mocked(sleep).mock.calls).toEqual([[2_000], [4_000], [8_000], [16_000]]);
    expect(AlertWebhookRepository.recordDelivery).toHaveBeenCalledWith("bot", WEBHOOK_ID, {
      lastError: "Discord API is unreachable or timed out",
    });
  });

  it("stops at once when Discord refuses the message", async () => {
    givenWebhook(saved());
    deliveries({ status: "REFUSED", reason: "Discord refused the message: Invalid Form Body" });

    AlertWebhookService.alertRaised("bot", alert());
    await AlertWebhookService.idle();

    expect(DiscordService.executeWebhook).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("posts the alerts in the order they happened", async () => {
    givenWebhook(saved());
    vi.mocked(DiscordService.executeWebhook).mockResolvedValue({ status: "SENT" });

    AlertWebhookService.alertRaised("bot", alert({ clusterId: 0 }));
    AlertWebhookService.alertRaised("bot", alert({ clusterId: 1 }));
    await AlertWebhookService.idle();

    expect(sentMessages().map(({ embeds }) => embeds[0].title)).toEqual([
      "Cluster 00 is down",
      "Cluster 01 is down",
    ]);
  });
});
