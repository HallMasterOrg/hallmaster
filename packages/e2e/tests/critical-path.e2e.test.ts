import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BOT_PROFILE,
  BOT_TOKEN,
  CONTAINER_IMAGE,
  RECOMMENDED_SHARDS,
  STRANGER,
} from "../setup/fixtures";
import {
  clusterRow,
  countRemoteCalls,
  newPage,
  openBrowser,
  useDiscordAccount,
  visible,
} from "./browser";

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

function discordLogin(page: Page) {
  return page.getByRole("link", { name: "Continue with Discord" });
}

async function expectNoRequestLoop(page: Page) {
  const remoteCalls = countRemoteCalls(page);
  const login = discordLogin(page);
  await login.focus();
  const callsBefore = remoteCalls();
  await page.waitForTimeout(2_000);

  expect(remoteCalls() - callsBefore).toBe(0);
  expect(await login.evaluate((link) => link === document.activeElement)).toBe(true);
}

describe("first visit", () => {
  it("sends the first visitor of a new instance to the setup page", async () => {
    await page.goto("/clusters");
    await page.waitForURL("**/setup");

    await visible(discordLogin(page));
    await expectNoRequestLoop(page);
  });

  it("sends the login page to the setup page while there is no account", async () => {
    await page.goto("/login");
    await page.waitForURL("**/setup");
  });
});

describe("onboarding", () => {
  it("creates the account with Discord and moves to the bot step", async () => {
    await discordLogin(page).click();

    await page.waitForURL("**/setup");
    await visible(page.getByLabel("Container image url"));
  });

  it("keeps the dashboard closed until the bot is registered", async () => {
    for (const path of ["/clusters", "/stats", "/layout", "/settings"]) {
      const response = await page.request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(303);
      expect(response.headers().location).toBe("/setup");
    }
  });

  it("asks a visitor without a session to log in before the bot step", async () => {
    const visitor = await newPage(browser);

    await visitor.goto("/setup");
    await visitor.waitForURL("**/login");

    await discordLogin(visitor).click();

    await visitor.waitForURL("**/setup");
    await visible(visitor.getByLabel("Container image url"));
    await visitor.context().close();
  });

  it("refuses another Discord account", async () => {
    const stranger = await newPage(browser);
    await useDiscordAccount(stranger, STRANGER);

    await stranger.goto("/login");
    await discordLogin(stranger).click();

    await stranger.waitForURL("**/login?error=forbidden");
    await visible(stranger.getByText("This Discord account cannot access this instance"));
    await stranger.context().close();
  });

  it("registers the bot", async () => {
    await page.getByLabel("Container image url").fill(CONTAINER_IMAGE);
    await page.getByLabel("Bot token").fill(BOT_TOKEN);
    await page.getByRole("button", { name: "Register bot" }).click();

    await page.waitForURL("**/clusters", { timeout: 120_000 });
    await visible(page.getByText("No clusters"));
    await visible(page.getByText(BOT_PROFILE.global_name));
  });

  it("closes the setup page once the bot is registered", async () => {
    await page.goto("/setup");
    await page.waitForURL("**/clusters");
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
  it("logs out", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("button", { name: "Confirm action" }).click();
    await page.waitForURL("**/login");
    await expectNoRequestLoop(page);
  });

  it("logs back in with Discord and finds the clusters", async () => {
    await discordLogin(page).click();

    await page.waitForURL("**/clusters");
    await visible(clusterRow(page, 0).getByText("running", { exact: true }));
  });
});
