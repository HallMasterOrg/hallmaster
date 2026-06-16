import { command, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import {
  GetClusterLogsQuerySchema,
  GetClusterSchema,
  type GetAggregateStatsDto,
  type GetClusterDto,
  type GetClusterLogsDto,
  type GetClusterStatsDto,
} from "@hallmaster/backend/dto";
import { error } from "@sveltejs/kit";
import { EventSourceParserStream } from "eventsource-parser/stream";

export const getClusters = query(async (): Promise<GetClusterDto[]> => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${env.API_URL}/clusters`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 200: {
      const clusters: GetClusterDto[] = await response.json();
      return clusters.sort((a, b) => a.id - b.id);
    }
    case 401:
      return error(401, "Unauthorized");

    default:
      return error(500, "An error occurred");
  }
});

export const getClustersLive = query.live(async function* () {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${env.API_URL}/clusters/stream`, {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 200: {
      if (!response.body) return error(500, "An error occurred");

      const chunks = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        // @ts-ignore svelte-check false positive
        .values();

      for await (const clusters of chunks)
        yield (JSON.parse(clusters.data) as GetClusterDto[]).sort((a, b) => a.id - b.id);
      break;
    }
    case 401:
      return error(401, "Unauthorized");

    default:
      return error(500, "An error occurred");
  }
});

export const startCluster = command("unchecked", async (id: number) => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${env.API_URL}/clusters/${id}/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 204:
      return await getClusters().refresh();
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Cluster not found");

    default:
      return error(500, "An error occurred");
  }
});

export const stopCluster = command("unchecked", async (id: number) => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${env.API_URL}/clusters/${id}/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 204:
      return await getClusters().refresh();
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Cluster not found");

    default:
      return error(500, "An error occurred");
  }
});

export const restartCluster = command("unchecked", async (id: number) => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${env.API_URL}/clusters/${id}/restart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 204:
      return await getClusters().refresh();
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Cluster not found");

    default:
      return error(500, "An error occurred");
  }
});

export const getClusterLogs = query(
  GetClusterLogsQuerySchema.extend({
    id: GetClusterSchema.shape.id,
  }),
  async ({ id }): Promise<GetClusterLogsDto> => {
    const token = getRequestEvent().cookies.get("token");

    const response = await fetch(`${env.API_URL}/clusters/${id}/logs`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    switch (response.status) {
      case 200:
        const logs: GetClusterLogsDto = await response.json();
        return logs.reverse();
      case 401:
        return error(401, "Unauthorized");
      case 404:
        return error(404, "Cluster not found");

      default:
        return error(500, "An error occurred");
    }
  },
);

export const getClusterLogsLive = query.live(
  "unchecked",
  async function* (id: GetClusterDto["id"]) {
    const token = getRequestEvent().cookies.get("token");

    const response = await fetch(`${env.API_URL}/clusters/${id}/logs/stream`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
    });

    switch (response.status) {
      case 200: {
        if (!response.body) return error(500, "An error occurred");

        const chunks = response.body
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new EventSourceParserStream())
          // @ts-ignore svelte-check false positive
          .values();

        for await (const chunk of chunks) yield JSON.parse(chunk.data) as GetClusterLogsDto[number];
        break;
      }
      case 401:
        return error(401, "Unauthorized");

      default:
        return error(500, "An error occurred");
    }
  },
);

export const getClusterStatsLive = query.live(
  "unchecked",
  async function* (id: GetClusterDto["id"]) {
    const token = getRequestEvent().cookies.get("token");

    const response = await fetch(new URL(`/clusters/${id}/stats/stream?interval=2`, env.API_URL), {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
    });

    switch (response.status) {
      case 200: {
        if (!response.body) return error(500, "An error occurred");

        const chunks = response.body
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new EventSourceParserStream())
          // @ts-ignore svelte-check false positive
          .values();

        for await (const chunk of chunks) yield JSON.parse(chunk.data) as GetClusterStatsDto;
        break;
      }
      case 400:
        return error(400, "Cluster has no container or is not running");
      case 401:
        return error(401, "Unauthorized");
      case 404:
        return error(404, "Cluster not found");

      default:
        return error(500, "An error occurred");
    }
  },
);

export const getClustersStatsLive = query.live(async function* () {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(new URL("/clusters/stats/stream?interval=2", env.API_URL), {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 200: {
      if (!response.body) return error(500, "An error occurred");

      const chunks = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        // @ts-ignore svelte-check false positive
        .values();

      for await (const chunk of chunks) yield JSON.parse(chunk.data) as GetAggregateStatsDto;
      break;
    }
    case 401:
      return error(401, "Unauthorized");

    default:
      return error(500, "An error occurred");
  }
});
