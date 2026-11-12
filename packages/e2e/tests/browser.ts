import { chromium, type Browser, type Locator, type Page } from "playwright";
import { inject } from "vitest";

// A page in a fresh context: its own cookies, so its own session.
export async function newPage(browser: Browser) {
  const context = await browser.newContext({ baseURL: inject("baseURL") });

  return context.newPage();
}

export async function openBrowser() {
  const browser = await chromium.launch();
  const page = await newPage(browser);

  return { browser, page };
}

export async function useDiscordAccount(page: Page, user: { id: string }) {
  await page.context().addCookies([{ name: "user", value: user.id, url: inject("discordURL") }]);
}

export async function visible(locator: Locator) {
  await locator.waitFor({ state: "visible" });
}

// A row of the clusters page, found by the checkbox that selects it.
export function clusterRow(page: Page, id: number) {
  return page.locator(".card").filter({ has: page.getByLabel(`select-cluster-${id}`) });
}

export function countRemoteCalls(page: Page) {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().includes("/_app/remote/")) {
      count++;
    }
  });

  return () => count;
}

export function adminRow(page: Page, user: { username: string }) {
  return page
    .getByRole("list", { name: "Admins" })
    .getByRole("listitem")
    .filter({ hasText: `@${user.username}` });
}
