import type { LoginError } from "$lib/loginErrors";
import { redirect, type Cookies } from "@sveltejs/kit";

const STATE_COOKIE = "discord_state";
const STATE_PATH = "/login/discord";

export function redirectUri(url: URL) {
  return new URL(`${STATE_PATH}/callback`, url.origin).toString();
}

export function createState(cookies: Cookies) {
  const state = crypto.randomUUID();
  cookies.set(STATE_COOKIE, state, { path: STATE_PATH, maxAge: 600 });

  return state;
}

export function consumeState(cookies: Cookies) {
  const state = cookies.get(STATE_COOKIE);
  cookies.delete(STATE_COOKIE, { path: STATE_PATH });

  return state;
}

export function loginFailed(error: LoginError): never {
  redirect(303, `/login?error=${error}`);
}
