import authMiddlewares from "#middlewares/auth.middlware";
import {
  ClusterIdParamSchema,
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
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { streamSSE } from "hono/streaming";

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
        404: {
          description: "No cluster found",
          content: {
            "application/json": { example: "Clusters not found" },
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
    async (c) => {
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
  )
  .on(
    "POST",
    ["/start", "/stop", "/restart"],
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
        404: {
          description: "Not found",
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
          description: "Cluster not found",
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    async (c) => {
      const param = c.req.valid("param");
      const cluster = ClusterService.get(param.id);

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
          description: "Cluster not found",
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
          description: "Cluster not found",
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
    validator("query", ClusterLogsQuerySchema),
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
            "text/event-stream": { schema: resolver(ClusterLogsSchema) },
          },
        },
        404: {
          description: "Cluster not found",
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
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
        404: {
          description: "Cluster not found",
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
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
        404: {
          description: "Cluster not found",
        },
      },
    }),
    validator("param", ClusterIdParamSchema),
  )
  .on(
    "POST",
    ["/:id/start", "/:id/stop", "/:id/restart"],
    describeRoute({
      tags,
      description: "Start, stop or restart a cluster",
      responses: {
        204: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ClusterSchema) },
          },
        },
        404: {
          description: "Not found",
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
  );

export default clusterController;
