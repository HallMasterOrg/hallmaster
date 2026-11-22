import { command, form, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import {
  ContainerImageSchema,
  CreateBotSchema,
  EnvironmentSchema,
  UpdateClustersSchema,
  type ApiError,
  type Bot,
  type BotDiscordProfile,
  type Cluster,
  type ContainerImage,
  type Environment,
  type RecommendedShards,
  type WebhookStatus,
  type WebhookToken,
} from "@hallmaster/backend/schemas";
import { error, redirect } from "@sveltejs/kit";

import { getClusters, getOutdatedClusters } from "./clusters.remote";

export const createBot = form(
  CreateBotSchema.extend(ContainerImageSchema.shape),
  async ({ token, ...containerImage }) => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    };

    const botResponse = await fetch(new URL("/api/bot", env.API_URL), {
      method: "POST",
      headers,
      body: JSON.stringify({ token }),
    });

    switch (botResponse.status) {
      case 201:
      case 409:
        break;
      case 401:
        return error(401, "Unauthorized");
      case 424:
        return error(424, "Invalid Discord bot token");

      default:
        console.error(await botResponse.text());
        return error(500, "An error occurred");
    }

    const imageResponse = await fetch(new URL("/api/bot/container-image", env.API_URL), {
      method: "POST",
      headers,
      body: JSON.stringify(containerImage),
    });

    switch (imageResponse.status) {
      case 201:
        return redirect(303, "/clusters");
      case 401:
        return error(401, "Unauthorized");
      case 409:
        return error(409, "A bot already exists");
      case 424:
        return error(424, ((await imageResponse.json()) as ApiError).message);

      default:
        console.error(await imageResponse.text());
        return error(500, "An error occurred");
    }
  },
);

export const getBot = query<Bot>(async () => {
  const response = await fetch(new URL("/api/bot", env.API_URL), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return response.json();
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getBotProfile = query<BotDiscordProfile>(async () => {
  const response = await fetch(new URL("/api/bot/profile", env.API_URL), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return response.json();
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");
    case 424:
      return error(424, "Invalid Discord bot token");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getContainerImage = query<Omit<ContainerImage, "password">>(async () => {
  const response = await fetch(new URL("/api/bot/container-image", env.API_URL), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return response.json();
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getEnvironment = query<Environment>(async () => {
  const response = await fetch(new URL("/api/bot/environment", env.API_URL), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return response.json();
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getRecommendedShards = query<RecommendedShards["shards"]>(async () => {
  const response = await fetch(new URL("/api/bot/recommended-shards", env.API_URL), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return ((await response.json()) as RecommendedShards).shards;
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");
    case 424:
      return error(424, "Invalid Discord bot token");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const updateBotToken = form(CreateBotSchema, async (payload) => {
  const response = await fetch(new URL("/api/bot", env.API_URL), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 200:
      getBot().set((await response.json()) as Bot);
      await getOutdatedClusters().refresh();
      return;
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");
    case 424:
      return error(424, "Invalid Discord bot token");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const updateBotImage = form(ContainerImageSchema, async (payload) => {
  const response = await fetch(new URL("/api/bot/container-image", env.API_URL), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 200:
      getContainerImage().set((await response.json()) as Omit<ContainerImage, "password">);
      await getOutdatedClusters().refresh();
      return;
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");
    case 424:
      return error(424, ((await response.json()) as ApiError).message);

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const updateEnvironment = form(EnvironmentSchema.partial(), async ({ variables = [] }) => {
  const response = await fetch(new URL("/api/bot/environment", env.API_URL), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify({ variables }),
  });

  switch (response.status) {
    case 200:
      getEnvironment().set((await response.json()) as Environment);
      await getOutdatedClusters().refresh();
      return;
    case 400:
      return error(400, ((await response.json()) as ApiError).message);
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const updateBotLayout = command(UpdateClustersSchema, async (payload) => {
  const response = await fetch(new URL("/api/clusters", env.API_URL), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 202:
      getClusters().set((await response.json()) as Cluster[]);
      await getOutdatedClusters().refresh();
      return;
    case 400:
    case 409:
    case 424:
      return error(response.status, ((await response.json()) as ApiError).message);
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Bot not found");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const redeployClusters = command(async () => {
  const response = await fetch(new URL("/api/clusters/redeploy", env.API_URL), {
    method: "POST",
    headers: { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` },
  });

  switch (response.status) {
    case 202:
      getClusters().set((await response.json()) as Cluster[]);
      return;
    case 404:
    case 409:
    case 424:
      return error(response.status, ((await response.json()) as ApiError).message);
    case 401:
      return error(401, "Unauthorized");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getWebhook = query<WebhookStatus>(async () => {
  const response = await fetch(new URL("/api/bot/webhook", env.API_URL), {
    headers: { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` },
  });

  switch (response.status) {
    case 200:
      return response.json();
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const generateWebhookToken = command(async (): Promise<WebhookToken["token"]> => {
  const response = await fetch(new URL("/api/bot/webhook/token", env.API_URL), {
    method: "POST",
    headers: { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` },
  });

  switch (response.status) {
    case 200:
      getWebhook().set({ enabled: true });
      return ((await response.json()) as WebhookToken).token;
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Bot not found");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});
