import { command, form, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import {
  CreateBotSchema,
  UpdateBotSchema,
  type GetBotDto,
  type GetRecommendedShardsDto,
} from "@hallmaster/backend/dto";
import { error, redirect } from "@sveltejs/kit";

import { getClusters } from "./clusters.remote";

export const createBot = form(CreateBotSchema, async (payload) => {
  const response = await fetch(new URL("/bot", env.API_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 201:
      return redirect(303, "/");
    case 401:
      return error(401, "Unauthorized");
    case 409:
      return error(409, "A bot already exists");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getBot = query<GetBotDto>(async () => {
  const response = await fetch(new URL("/bot", env.API_URL), {
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

export const getRecommendedShards = query<GetRecommendedShardsDto["shards"]>(async () => {
  const response = await fetch(new URL("/bot/recommended-shards", env.API_URL), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return ((await response.json()) as GetRecommendedShardsDto).shards;
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const updateBotToken = form(UpdateBotSchema.pick({ token: true }), async (payload) => {
  const response = await fetch(new URL("/bot", env.API_URL), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 202:
      getBot().set(await response.json());
      return;
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const updateBotImage = form(UpdateBotSchema.pick({ dockerImage: true }), async (payload) => {
  const response = await fetch(new URL("/bot", env.API_URL), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 202:
      getBot().set((await response.json()) as GetBotDto);
      return;
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const updateBotLayout = command(UpdateBotSchema.pick({ layout: true }), async (payload) => {
  const response = await fetch(new URL("/bot", env.API_URL), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 202:
      await getClusters().refresh();
      return;
    case 401:
      return redirect(303, "/login");
    case 404:
      return redirect(303, "/setup");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});
