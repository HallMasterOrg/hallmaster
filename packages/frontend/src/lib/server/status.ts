import { env } from "$env/dynamic/private";
import type { Status } from "@hallmaster/backend/schemas";
import { error } from "@sveltejs/kit";

export async function getStatus(): Promise<Status> {
  const response = await fetch(new URL("/api/status", env.API_URL));

  if (!response.ok) {
    console.error(await response.text());
    return error(500, "An error occurred");
  }

  return (await response.json()) as Status;
}

// The backend refuses an expired or forged token with a 401 on any protected route.
export async function hasSession(token: string | undefined) {
  if (token === undefined) {
    return false;
  }

  const response = await fetch(new URL("/api/bot", env.API_URL), {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.status !== 401;
}
