import { command, form, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import {
  UpdateAlertWebhookSchema,
  type Alert,
  type AlertWebhook,
  type ApiError,
} from "@hallmaster/backend/schemas";
import { error, redirect } from "@sveltejs/kit";

function authorization() {
  return { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` };
}

async function failed(response: Response) {
  switch (response.status) {
    case 400:
    case 404:
    case 424:
      return error(response.status, ((await response.json()) as ApiError).message);
    case 401:
      return error(401, "Unauthorized");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
}

async function fetchAlerts(search: string): Promise<Alert[]> {
  const response = await fetch(new URL(`/api/alerts${search}`, env.API_URL), {
    headers: { Accept: "application/json", ...authorization() },
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

export const getAlertWebhook = query<AlertWebhook>(async () => {
  const response = await fetch(new URL("/api/alerts/webhook", env.API_URL), {
    headers: authorization(),
  });

  if (response.status === 401) return redirect(303, "/login");
  if (response.status === 404) return redirect(303, "/setup");

  return response.ok ? ((await response.json()) as AlertWebhook) : await failed(response);
});

export const updateAlertWebhook = form(UpdateAlertWebhookSchema, async (payload) => {
  const response = await fetch(new URL("/api/alerts/webhook", env.API_URL), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authorization() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) return await failed(response);

  getAlertWebhook().set((await response.json()) as AlertWebhook);
});

export const removeAlertWebhook = command(async () => {
  const response = await fetch(new URL("/api/alerts/webhook", env.API_URL), {
    method: "DELETE",
    headers: authorization(),
  });

  if (!response.ok) return await failed(response);

  getAlertWebhook().set((await response.json()) as AlertWebhook);
});

export const testAlertWebhook = command(async () => {
  const response = await fetch(new URL("/api/alerts/webhook/test", env.API_URL), {
    method: "POST",
    headers: authorization(),
  });

  if (!response.ok) return await failed(response);

  getAlertWebhook().set((await response.json()) as AlertWebhook);
});
