import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import DiscordService from "#services/discord.service";

import { createBot, register, request, resetState } from "./helpers";

const WEBHOOK_ID = "1234567890123456789";
const WEBHOOK_URL = `https://discord.com/api/webhooks/${WEBHOOK_ID}/a-secret_Webhook-token`;

let token: string;

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await request(path, { ...init, token });

  return { status: response.status, body: (await response.json()) as unknown };
}

function save(body: Record<string, unknown> = {}) {
  return call("/alerts/webhook", {
    method: "PUT",
    body: {
      url: WEBHOOK_URL,
      enabled: true,
      content: "@everyone",
      kinds: ["STOPPED", "CRASH_LOOP"],
      notifyResolved: false,
      ...body,
    },
  });
}

afterAll(async () => {
  await resetState();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetState();
  token = await register();
});

describe("alert webhook", () => {
  beforeEach(async () => {
    await createBot();
  });

  it("starts without a webhook", async () => {
    expect(await call("/alerts/webhook")).toEqual({
      status: 200,
      body: {
        webhookId: null,
        enabled: false,
        content: "",
        kinds: ["STOPPED", "CRASH_LOOP", "OOM_KILLED"],
        notifyResolved: false,
        lastDeliveredAt: null,
        lastError: null,
      },
    });
  });

  it("saves the webhook and never gives its token back", async () => {
    const saved = await save();

    expect(saved).toEqual({
      status: 200,
      body: {
        webhookId: WEBHOOK_ID,
        enabled: true,
        content: "@everyone",
        kinds: ["STOPPED", "CRASH_LOOP"],
        notifyResolved: false,
        lastDeliveredAt: null,
        lastError: null,
      },
    });
    expect(JSON.stringify(await call("/alerts/webhook"))).not.toContain("a-secret_Webhook-token");
  });

  it("keeps the saved webhook when the URL is left empty", async () => {
    await save();

    const { body } = await save({ url: "", content: "<@&222222222222222222>" });

    expect(body).toMatchObject({ webhookId: WEBHOOK_ID, content: "<@&222222222222222222>" });
  });

  it.each([
    ["a URL that is not a Discord webhook", { url: "https://example.com/hook" }, "url"],
    ["no alert picked", { kinds: [] }, "kinds"],
    ["a message longer than Discord allows", { content: "a".repeat(2001) }, "content"],
  ])("refuses %s", async (_case, body, path) => {
    const { status, body: error } = await save(body);

    expect(status).toBe(400);
    expect(error).toMatchObject({ issues: [{ path }] });
  });

  it("asks for a URL before the first save", async () => {
    const { status, body } = await save({ url: undefined });

    expect(status).toBe(400);
    expect(body).toMatchObject({
      issues: [{ path: "url", message: "Paste the URL of a Discord webhook" }],
    });
  });

  it("posts a test message to the saved webhook", async () => {
    const execute = vi
      .spyOn(DiscordService, "executeWebhook")
      .mockResolvedValue({ status: "SENT" });
    await save();

    const { status, body } = await call("/alerts/webhook/test", { method: "POST" });

    expect(status).toBe(200);
    expect(body).toMatchObject({ lastDeliveredAt: expect.any(String), lastError: null });
    expect(execute).toHaveBeenCalledWith(
      { id: WEBHOOK_ID, token: "a-secret_Webhook-token" },
      expect.objectContaining({ content: "@everyone" }),
    );
  });

  it("keeps the reason of a failed test until a new URL is saved", async () => {
    const reason = "Discord does not know this webhook anymore, paste a new URL";
    vi.spyOn(DiscordService, "executeWebhook").mockResolvedValue({ status: "REFUSED", reason });
    await save();

    expect(await call("/alerts/webhook/test", { method: "POST" })).toEqual({
      status: 424,
      body: { message: reason },
    });
    expect((await call("/alerts/webhook")).body).toMatchObject({ lastError: reason });

    const { body } = await save();
    expect(body).toMatchObject({ lastError: null });
  });

  it("refuses a test without a webhook", async () => {
    expect(await call("/alerts/webhook/test", { method: "POST" })).toEqual({
      status: 404,
      body: { message: "Alert webhook not found" },
    });
  });

  it("forgets the webhook", async () => {
    await save();

    const { status } = await call("/alerts/webhook", { method: "DELETE" });

    expect(status).toBe(200);
    expect((await call("/alerts/webhook")).body).toMatchObject({ webhookId: null });
  });
});

describe("without a bot", () => {
  it("reports it", async () => {
    expect(await call("/alerts/webhook")).toEqual({
      status: 404,
      body: { message: "Bot not found" },
    });
    expect((await save()).status).toBe(404);
  });
});
