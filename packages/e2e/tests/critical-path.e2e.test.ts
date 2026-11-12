import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  BOT_PROFILE,
  BOT_TOKEN,
  CONTAINER_IMAGE,
  RECOMMENDED_SHARDS,
  USER,
} from "../setup/fixtures";
import { clusterRow, countRemoteCalls, newPage, openBrowser, visible } from "./browser";

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

async function expectNoRequestLoop(page: Page) {
  const remoteCalls = countRemoteCalls(page);
  const username = page.getByLabel("Username");
  await username.focus();
  const callsBefore = remoteCalls();
  await page.waitForTimeout(2_000);

  expect(remoteCalls() - callsBefore).toBe(0);
  expect(await username.evaluate((input) => input === document.activeElement)).toBe(true);
}

describe("first visit", () => {
  it("sends the first visitor of a new instance to the setup page", async () => {
    await page.goto("/clusters");
    await page.waitForURL("**/setup");

    await visible(page.getByRole("button", { name: "Create account" }));
    await expectNoRequestLoop(page);
  });

  it("sends the login page to the setup page while there is no account", async () => {
    await page.goto("/login");
    await page.waitForURL("**/setup");
  });
});

describe("onboarding", () => {
  it("creates the account and moves to the bot step", async () => {
    await page.getByLabel("Username").fill(USER.username);
    await page.getByLabel("Password").fill(USER.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await visible(page.getByLabel("Container image url"));
  });

  it("asks a visitor without a session to log in before the bot step", async () => {
    const visitor = await newPage(browser);

    await visitor.goto("/setup");
    await visitor.waitForURL("**/login");

    await visitor.getByLabel("Username").fill(USER.username);
    await visitor.getByLabel("Password").fill(USER.password);
    await visitor.getByRole("button", { name: "Login" }).click();

    await visitor.waitForURL("**/setup");
    await visible(visitor.getByLabel("Container image url"));
    await visitor.context().close();
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
  it("logs out and refuses a wrong password", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("button", { name: "Confirm action" }).click();
    await page.waitForURL("**/login");
    await expectNoRequestLoop(page);

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

describe("expired session", () => {
  it("sends the user to the login page when a cluster action is refused", async () => {
    const pageErrors: Error[] = [];
    const onPageError = (error: Error) => pageErrors.push(error);
    page.on("pageerror", onPageError);

    await page.context().clearCookies();
    await page.getByRole("button", { name: "stop cluster 01" }).click();

    await page.waitForURL("**/login");
    await visible(page.getByText("Unauthorized", { exact: true }));
    page.off("pageerror", onPageError);
    expect(pageErrors).toEqual([]);
  });

  it("logs back in and finds the cluster still running", async () => {
    await page.getByLabel("Username").fill(USER.username);
    await page.getByLabel("Password").fill(USER.password);
    await page.getByRole("button", { name: "Login" }).click();

    await page.waitForURL("**/clusters");
    await visible(clusterRow(page, 1).getByText("running", { exact: true }));
  });
});
