import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BOT_PROFILE,
  BOT_TOKEN,
  CONTAINER_IMAGE,
  RECOMMENDED_SHARDS,
  USER,
} from "../setup/fixtures";
import { clusterRow, countRemoteCalls, openBrowser, visible } from "./browser";

// The steps share one browser and one backend: each one starts where the previous one stopped.
let browser: Browser;
let page: Page;

beforeAll(async () => {
  ({ browser, page } = await openBrowser());
});

beforeEach(({ task, onTestFailed }) => {
  onTestFailed(async () => {
    await page.screenshot({ path: `.logs/${task.name.replaceAll(" ", "-")}.png`, fullPage: true });
  });
});

afterAll(async () => {
  await browser.close();
});

describe("first visit", () => {
  it("sends a visitor without a session to the login page, once", async () => {
    const remoteCalls = countRemoteCalls(page);

    await page.goto("/clusters");
    await page.waitForURL("**/login");

    const username = page.getByLabel("Username");
    await username.focus();
    const callsOnLogin = remoteCalls();
    await page.waitForTimeout(2_000);

    expect(remoteCalls() - callsOnLogin).toBe(0);
    expect(await username.evaluate((input) => input === document.activeElement)).toBe(true);
  });
});

describe("onboarding", () => {
  it("creates the account and registers the bot", async () => {
    await page.goto("/setup");
    await page.getByLabel("Username").fill(USER.username);
    await page.getByLabel("Password").fill(USER.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/setup#bot");

    await page.getByLabel("Container image url").fill(CONTAINER_IMAGE);
    await page.getByLabel("Bot token").fill(BOT_TOKEN);
    await page.getByRole("button", { name: "Register bot" }).click();

    await page.waitForURL("**/clusters", { timeout: 120_000 });
    await visible(page.getByText("No clusters"));
    await visible(page.getByText(BOT_PROFILE.global_name));
  });
});

describe("cluster layout", () => {
  it("shows the number of shards recommended by Discord", async () => {
    await page.goto("/layout");

    const recommended = page.locator(".badge", { hasText: "Recommended amount" });
    await expect
      .poll(async () => (await recommended.textContent())?.replace(/\s+/g, " ").trim(), {
        timeout: 10_000,
      })
      .toBe(`Recommended amount: ${RECOMMENDED_SHARDS}`);
  });

  it("applies a layout of two clusters and starts them", async () => {
    await page.getByRole("button", { name: "Add a cluster" }).click();
    await page.getByRole("button", { name: "Add a shard" }).click();
    await page.getByRole("button", { name: "Add a cluster" }).click();

    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("button", { name: "Confirm action" }).click();
    await visible(page.getByText("Successfully applied layout"));

    await page.goto("/clusters");
    await visible(clusterRow(page, 0).getByText("running", { exact: true }));
    await visible(clusterRow(page, 1).getByText("running", { exact: true }));
  });
});

describe("cluster actions", () => {
  it("stops a cluster and starts it again", async () => {
    const row = clusterRow(page, 1);

    await page.getByRole("button", { name: "stop cluster 01" }).click();
    await visible(row.getByText("stopped", { exact: true }));
    await visible(clusterRow(page, 0).getByText("running", { exact: true }));

    await page.getByRole("button", { name: "start cluster 01" }).click();
    await visible(row.getByText("running", { exact: true }));
  });
});

describe("session", () => {
  it("logs out and refuses a wrong password", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("button", { name: "Confirm action" }).click();
    await page.waitForURL("**/login");

    await page.getByLabel("Username").fill(USER.username);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Login" }).click();

    // The login form marks both fields as invalid, without a message
    await expect
      .poll(() => page.getByLabel("Password").getAttribute("aria-invalid"), { timeout: 10_000 })
      .toBe("true");
    expect(page.url()).toContain("/login");
  });

  it("logs back in and finds the clusters", async () => {
    await page.getByLabel("Password").fill(USER.password);
    await page.getByRole("button", { name: "Login" }).click();

    await page.waitForURL("**/clusters");
    await visible(clusterRow(page, 0).getByText("running", { exact: true }));
  });
});
