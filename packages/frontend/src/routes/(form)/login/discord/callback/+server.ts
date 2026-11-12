import { env } from "$env/dynamic/private";
import { consumeState, loginFailed, redirectUri } from "$lib/server/discord";
import { getStatus } from "$lib/server/status";
import type { UserTokenResponse } from "@hallmaster/backend/schemas";
import { redirect } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, cookies }) => {
  const state = consumeState(cookies);
  const code = url.searchParams.get("code");

  if (code === null) {
    redirect(303, "/login");
  }

  if (state === undefined || url.searchParams.get("state") !== state) {
    loginFailed("failed");
  }

  const response = await fetch(new URL("/api/auth/discord", env.API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri: redirectUri(url) }),
  });

  if (response.status === 403) {
    loginFailed("forbidden");
  }

  if (!response.ok) {
    console.error(await response.text());
    loginFailed("failed");
  }

  const { token } = (await response.json()) as UserTokenResponse;
  cookies.set("token", token, { path: "/" });

  const { hasBot } = await getStatus();
  redirect(303, hasBot ? "/clusters" : "/setup");
};
