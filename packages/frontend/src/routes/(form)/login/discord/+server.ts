import { env } from "$env/dynamic/private";
import { createState, loginFailed, redirectUri } from "$lib/server/discord";
import type { DiscordAuthorizationUrl } from "@hallmaster/backend/schemas";
import { redirect } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, cookies }) => {
  const query = new URLSearchParams({ redirectUri: redirectUri(url), state: createState(cookies) });
  const response = await fetch(new URL(`/api/auth/discord?${query}`, env.API_URL));

  if (!response.ok) {
    console.error(await response.text());
    loginFailed("failed");
  }

  const authorization = (await response.json()) as DiscordAuthorizationUrl;
  redirect(303, authorization.url);
};
