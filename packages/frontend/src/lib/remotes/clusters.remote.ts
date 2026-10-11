import { command, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import BatchStream from "$lib/utils/BatchStream";
import {
  ClusterIdSchema,
  ClusterLogsQuerySchema,
  SseIntervalQuerySchema,
  type ApiError,
  type Cluster,
  type ClusterLogs,
  type ClusterStats,
  type ClustersStats,
} from "@hallmaster/backend/schemas";
import { error, redirect } from "@sveltejs/kit";
import { EventSourceParserStream, type EventSourceMessage } from "eventsource-parser/stream";

async function clusterAction(
  id: Cluster["id"],
  action: "start" | "stop" | "restart",
): Promise<void> {
  const response = await fetch(new URL(`/api/clusters/${id}/${action}`, env.API_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200:
      return await getClusters().refresh();
    case 401:
      return redirect(303, "/login");
    case 404:
      return error(404, "Cluster not found");
    case 424:
      return error(424, ((await response.json()) as ApiError).message);

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
}

async function clustersBatchAction<I = Cluster["id"]>(
  ids: I[],
  action: "start" | "stop" | "restart",
): Promise<(arg: I, index: number) => unknown> {
  const promises = await Promise.all(
    ids.map((id) =>
      fetch(new URL(`/api/clusters/${String(id)}/${action}`, env.API_URL), {
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
      case 200:
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
  ClusterIdSchema,
  async (id) => await clusterAction(id, "start"),
);

export const restartCluster = command(
  ClusterIdSchema,
  async (id) => await clusterAction(id, "restart"),
);

export const stopCluster = command(ClusterIdSchema, async (id) => await clusterAction(id, "stop"));

export const getClusterLogs = query(
  ClusterLogsQuerySchema.extend({
    id: ClusterIdSchema,
  }),
  async ({ id }): Promise<ClusterLogs> => {
    const response = await fetch(new URL(`/api/clusters/${id}/logs`, env.API_URL), {
      headers: { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` },
    });

    switch (response.status) {
      case 200:
        return (await response.json()) as ClusterLogs;
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

export const getClusterLogsLive = query.live(ClusterIdSchema, async function* (id) {
  const response = await fetch(new URL(`/api/clusters/${id}/logs/sse`, env.API_URL), {
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
        yield chunk.map(({ data }: EventSourceMessage) => JSON.parse(data)) as ClusterLogs;
      }
      return;
    }
    case 401:
      return redirect(303, "/login");
    case 404:
      return error(404, "Cluster not found");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getClusterStatsLive = query.live(ClusterIdSchema, async function* (id) {
  const response = await fetch(new URL(`/api/clusters/${id}/stats/sse`, env.API_URL), {
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
        yield { ...(JSON.parse(chunk.data) as ClusterStats), date: new Date() };
      return;
    }
    case 400:
      return error(400, "Cluster is not running");
    case 401:
      return redirect(303, "/login");
    case 404:
      return error(404, "Cluster not found");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const getClusters = query(async (): Promise<Cluster[]> => {
  const response = await fetch(new URL("/api/clusters", env.API_URL), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getRequestEvent().cookies.get("token")}`,
    },
  });

  switch (response.status) {
    case 200: {
      const clusters: Cluster[] = await response.json();
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
  const response = await fetch(new URL("/api/clusters/sse", env.API_URL), {
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
        yield (JSON.parse(clusters.data) as Cluster[]).sort((a, b) => a.id - b.id);
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
      new URL(`/api/clusters/stats/sse?interval=${interval}`, env.API_URL),
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
          yield { ...(JSON.parse(chunk.data) as ClustersStats), date: new Date() };
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
  async (ids: Cluster["id"][]) => await clustersBatchAction(ids, "start"),
);

export const restartClusters = query.batch(
  "unchecked",
  async (ids: Cluster["id"][]) => await clustersBatchAction(ids, "restart"),
);

export const stopClusters = query.batch(
  "unchecked",
  async (ids: Cluster["id"][]) => await clustersBatchAction(ids, "stop"),
);
