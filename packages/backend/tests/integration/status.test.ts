import { beforeEach, describe, expect, it } from "vitest";

import { createBot, register, request, resetState } from "./helpers";

async function status() {
  const response = await request("/status");

  return { status: response.status, body: (await response.json()) as unknown };
}

beforeEach(async () => {
  await resetState();
});

describe("onboarding status", () => {
  it("is readable without a session", async () => {
    expect(await status()).toEqual({ status: 200, body: { hasUser: false, hasBot: false } });
  });

  it("follows the onboarding steps", async () => {
    const token = await register();
    expect((await status()).body).toEqual({ hasUser: true, hasBot: false });

    await createBot();
    expect((await status()).body).toEqual({ hasUser: true, hasBot: false });

    const response = await request("/bot/container-image", {
      method: "POST",
      token,
      body: { url: "nginx:alpine" },
    });
    expect(response.status).toBe(201);
    expect((await status()).body).toEqual({ hasUser: true, hasBot: true });
  });
});
