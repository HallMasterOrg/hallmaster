import { getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import type { Alert } from "@hallmaster/backend/schemas";
import { error } from "@sveltejs/kit";

async function fetchAlerts(search: string): Promise<Alert[]> {
  const response = await fetch(new URL(`/api/alerts${search}`, env.API_URL), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return response.json();
    case 401:
      return [];

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
}

export const getAlerts = query(() => fetchAlerts(""));

export const getActiveAlerts = query(() => fetchAlerts("?active=true"));
