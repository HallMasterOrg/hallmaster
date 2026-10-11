import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { streamSSE } from "hono/streaming";

import authMiddlewares from "#middlewares/auth.middlware";
import {
  ClusterActionParamSchema,
  ClusterIdActionParamSchema,
  ClusterIdParamSchema,
  ClusterLogSchema,
  ClusterLogsQuerySchema,
  ClusterLogsSchema,
  ClustersBulkActionResultSchema,
  ClusterSchema,
  ClustersSchema,
  ClustersStatsSchema,
  ClusterStatsSchema,
  SseIntervalQuerySchema,
  UpdateClustersSchema,
} from "#schemas/cluster.schema";
import ClusterService from "#services/cluster.service";

const tags = ["Clusters"];

const clusterController = new Hono()
  .use(...authMiddlewares)
  .get(
    "/",
    describeRoute({
      tags,
      description: "Get clusters",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ClustersSchema) },
          },
        },
      },
    }),
    async (c) => {
      const clusters = await ClusterService.getAll();

      return c.json(clusters, 200);
    },
  )
  .put(
    "/",
    describeRoute({
      tags,
      description: "Update cluster layout",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ClustersSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": {
              examples: {
                "Bot not found": { value: "Bot not found" },
                "Container image not found": { value: "Container image not found" },
              },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
            },
          },
        },
      },
    }),
    validator("json", UpdateClustersSchema),
    async (c) => {
      const layout = c.req.valid("json");
      const clusters = await ClusterService.updateAll(layout);

      return c.json(clusters, 200);
    },
  )
  .get(
    "/sse",
    describeRoute({
      tags,
      description: "Steam clusters",
      responses: {
        200: {
          description: "Server-Sent Events listing clusters",
          content: {
            "text/event-stream": { schema: resolver(ClustersSchema) },
          },
        },
      },
    }),
    validator("query", SseIntervalQuerySchema),
    (c) => {
      const query = c.req.valid("query");

      return streamSSE(c, async (stream) => {
        while (!stream.aborted) {
          const clusters = await ClusterService.getAll();

          await stream.writeSSE({
            data: JSON.stringify(clusters),
          });

          await stream.sleep(query.interval * 1000);
        }
      });
    },
  )
  .get(
    "/stats/sse",
    describeRoute({
      tags,
      description: "Stream clusters stats",
      responses: {
        200: {
          description: "Server-Sent Events listing clusters stats",
          content: {
            "text/event-stream": { schema: resolver(ClustersStatsSchema) },
          },
        },
      },
    }),
    validator("query", SseIntervalQuerySchema),
    (c) => {
      const query = c.req.valid("query");

      return streamSSE(c, async (stream) => {
        while (!stream.aborted) {
          const stats = await ClusterService.getAllStats();

          await stream.writeSSE({
            data: JSON.stringify(stats),
          });

          await stream.sleep(query.interval * 1000);
        }
      });
    },
  )
  .post(
    "/:action{(?:start|stop|restart)}",
    describeRoute({
      tags,
      description:
        "Start, stop or restart every cluster (clusters already in the requested state are ignored)",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ClustersBulkActionResultSchema) },
          },
        },
      },
    }),
    validator("param", ClusterActionParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const result = await ClusterService.runActionOnAll(param.action);

      return c.json(result, 200);
    },
  )
  .get(
    "/:id",
    describeRoute({
      tags,
      description: "Get a cluster",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ClusterSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Cluster not found" },
          },
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const cluster = await ClusterService.get(param.id);

      return c.json(cluster, 200);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      tags,
      description: "Delete a cluster",
      responses: {
        200: {
          description: "Deleted cluster",
          content: {
            "application/json": { schema: resolver(ClusterSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Cluster not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
            },
          },
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const cluster = await ClusterService.remove(param.id);

      return c.json(cluster, 200);
    },
  )
  .get(
    "/:id/logs",
    describeRoute({
      tags,
      description: "Get a cluster logs",
      responses: {
        200: {
          description: "Logs of the cluster",
          content: {
            "application/json": { schema: resolver(ClusterLogsSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Cluster not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
            },
          },
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    validator("query", ClusterLogsQuerySchema),
    async (c) => {
      const param = c.req.valid("param");
      const query = c.req.valid("query");

      const logs = await ClusterService.logs(param.id, query);

      return c.json(logs, 200);
    },
  )
  .get(
    "/:id/logs/sse",
    describeRoute({
      tags,
      description: "Stream cluster logs",
      responses: {
        200: {
          description: "Server-Sent Events with cluster logs",
          content: {
            "text/event-stream": { schema: resolver(ClusterLogSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Cluster not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
            },
          },
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const logs = await ClusterService.streamLogs(param.id);

      return streamSSE(c, async (stream) => {
        stream.onAbort(() => {
          logs.destroy();
        });

        try {
          for await (const log of logs) {
            await stream.writeSSE({ data: JSON.stringify(log) });
          }
        } catch (error) {
          if (!stream.aborted) {
            throw error;
          }
        }
      });
    },
  )
  .get(
    "/:id/stats",
    describeRoute({
      tags,
      description: "Get cluster stats",
      responses: {
        200: {
          description: "Cluster stats",
          content: {
            "application/json": { schema: resolver(ClusterStatsSchema) },
          },
        },
        400: {
          description: "Bad Request",
          content: {
            "text/plain": { example: "Cluster 0 is not running" },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Cluster not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
            },
          },
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const stats = await ClusterService.stats(param.id);

      return c.json(stats, 200);
    },
  )
  .get(
    "/:id/stats/sse",
    describeRoute({
      tags,
      description: "Stream cluster stats",
      responses: {
        200: {
          description: "Server-Sent Events with cluster stats",
          content: {
            "text/event-stream": { schema: resolver(ClusterStatsSchema) },
          },
        },
        400: {
          description: "Bad Request",
          content: {
            "text/plain": { example: "Cluster 0 is not running" },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Cluster not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
            },
          },
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const stats = await ClusterService.streamStats(param.id);

      return streamSSE(c, async (stream) => {
        stream.onAbort(() => {
          stats.destroy();
        });

        try {
          for await (const sample of stats) {
            await stream.writeSSE({ data: JSON.stringify(sample) });
          }
        } catch (error) {
          if (!stream.aborted) {
            throw error;
          }
        }
      });
    },
  )
  .post(
    "/:id/:action{(?:start|stop|restart)}",
    describeRoute({
      tags,
      description: "Start, stop or restart a cluster",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ClusterSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Cluster not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
            },
          },
        },
      },
    }),
    validator("param", ClusterIdActionParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const cluster = await ClusterService.runAction(param.id, param.action);

      return c.json(cluster, 200);
    },
  );

export default clusterController;
