import { command, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import BatchStream from "$lib/utils/BatchStream";
import {
  ClusterIdParamSchema,
  GetClusterLogsQuerySchema,
  GetClusterSchema,
  SseIntervalQuerySchema,
  type GetAggregateStatsDto,
  type GetClusterDto,
  type GetClusterLogsDto,
  type GetClusterStatsDto,
} from "@hallmaster/backend/dto";
import { error, redirect } from "@sveltejs/kit";
import { EventSourceParserStream, type EventSourceMessage } from "eventsource-parser/stream";

async function clusterAction(
  id: GetClusterDto["id"],
  action: "start" | "stop" | "restart",
): Promise<void> {
  const response = await fetch(new URL(`/clusters/${id}/${action}`, env.API_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 204:
      return await getClusters().refresh();
    case 401:
      return redirect(303, "/login");
    case 404:
      return error(404, "Cluster not found");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
}

async function clustersBatchAction<I = GetClusterDto["id"]>(
  ids: I[],
  action: "start" | "stop" | "restart",
): Promise<(arg: I, index: number) => unknown> {
  const promises = await Promise.all(
    ids.map((id) =>
      fetch(new URL(`/clusters/${String(id)}/${action}`, env.API_URL), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
        },
      }),
    ),
  );

  return (_, index) => {
    const response = promises[index];

    switch (response.status) {
      case 204:
        return;
      case 401:
        return redirect(303, "/login");
      case 404:
        return error(404, "Cluster not found");

      default:
        void response.text().then(console.error);
        return error(500, "An error occurred");
    }
  };
}

export const startCluster = command(
  ClusterIdParamSchema.shape.id,
  async (id) => await clusterAction(id, "start"),
);

export const restartCluster = command(
  ClusterIdParamSchema.shape.id,
  async (id) => await clusterAction(id, "restart"),
);

export const stopCluster = command(
  ClusterIdParamSchema.shape.id,
  async (id) => await clusterAction(id, "stop"),
);

export const getClusterLogs = query(
  GetClusterLogsQuerySchema.extend({
    id: GetClusterSchema.shape.id,
  }),
  async ({ id }): Promise<GetClusterLogsDto> => {
    const response = await fetch(`${env.API_URL}/clusters/${id}/logs`, {
      headers: { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` },
    });

    switch (response.status) {
      case 200:
        return (await response.json()) as GetClusterLogsDto;
      case 401:
        return redirect(303, "/login");
      case 404:
        return error(404, "Cluster not found");

      default:
        console.error(await response.text());
        return error(500, "An error occurred");
    }
  },
);

export const getClusterLogsLive = query.live(ClusterIdParamSchema.shape.id, async function* (id) {
  const response = await fetch(`${env.API_URL}/clusters/${id}/logs/stream`, {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200: {
      if (!response.body) {
        console.error(await response.text());
        return error(500, "An error occurred");
      }

      const chunks = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeThrough(new BatchStream())
        // @ts-ignore svelte-check false positive
        .values();

      for await (const chunk of chunks) {
        yield chunk.map(({ data }: EventSourceMessage) => JSON.parse(data)) as GetClusterLogsDto;
      }
      return;
    }
    case 400:
      return error(400, "Cluster has no bound container");
    case 401:
      return redirect(303, "/login");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getClusterStatsLive = query.live(ClusterIdParamSchema.shape.id, async function* (id) {
  const response = await fetch(new URL(`/clusters/${id}/stats/stream`, env.API_URL), {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200: {
      if (!response.body) {
        console.error(await response.text());
        return error(500, "An error occurred");
      }

      const chunks = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        // @ts-ignore svelte-check false positive
        .values();

      for await (const chunk of chunks)
        yield { ...(JSON.parse(chunk.data) as GetClusterStatsDto), date: new Date() };
      return;
    }
    case 400:
      return error(400, "Cluster has no container or is not running");
    case 401:
      return redirect(303, "/login");
    case 404:
      return error(404, "Cluster not found");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getClusters = query(async (): Promise<GetClusterDto[]> => {
  const response = await fetch(new URL("/clusters", env.API_URL), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200: {
      const clusters: GetClusterDto[] = await response.json();
      return clusters.sort((a, b) => a.id - b.id);
    }
    case 401:
      return redirect(303, "/login");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getClustersLive = query.live(async function* () {
  const response = await fetch(new URL("/clusters/stream", env.API_URL), {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200: {
      if (!response.body) {
        console.error(await response.text());
        return error(500, "An error occurred");
      }

      const chunks = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        // @ts-ignore svelte-check false positive
        .values();

      for await (const clusters of chunks)
        yield (JSON.parse(clusters.data) as GetClusterDto[]).sort((a, b) => a.id - b.id);
      return;
    }
    case 401:
      return redirect(303, "/login");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getClustersStatsLive = query.live(
  SseIntervalQuerySchema,
  async function* ({ interval }) {
    const response = await fetch(
      new URL(`/clusters/stats/stream?interval=${interval}`, env.API_URL),
      {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
        },
      },
    );

    switch (response.status) {
      case 200: {
        if (!response.body) {
          console.error(await response.text());
          return error(500, "An error occurred");
        }

        const chunks = response.body
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new EventSourceParserStream())
          // @ts-ignore svelte-check false positive
          .values();

        for await (const chunk of chunks)
          yield { ...(JSON.parse(chunk.data) as GetAggregateStatsDto), date: new Date() };
        return;
      }
      case 401:
        return redirect(303, "/login");

      default:
        console.error(await response.text());
        return error(500, "An error occurred");
    }
  },
);

export const startClusters = query.batch(
  "unchecked",
  async (ids: GetClusterDto["id"][]) => await clustersBatchAction(ids, "start"),
);

export const restartClusters = query.batch(
  "unchecked",
  async (ids: GetClusterDto["id"][]) => await clustersBatchAction(ids, "restart"),
);

export const stopClusters = query.batch(
  "unchecked",
  async (ids: GetClusterDto["id"][]) => await clustersBatchAction(ids, "stop"),
);
