import { chromium, type Locator, type Page } from "playwright";
import { inject } from "vitest";

export async function openBrowser() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: inject("baseURL") });
  const page = await context.newPage();

  return { browser, page };
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
