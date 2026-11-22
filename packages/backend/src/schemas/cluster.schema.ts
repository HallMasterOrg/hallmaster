import z from "zod";

export const ClusterIdSchema = z.coerce.number().int().nonnegative().meta({
  description: "Cluster ID",
});
export type ClusterId = z.infer<typeof ClusterIdSchema>;

export const ClusterStatusSchema = z
  .enum(["STARTING", "RUNNING", "STOPPED", "ERROR", "UPDATING", "WAITING"])
  .meta({
    description:
      "Status of the cluster. WAITING: a deployment starts or replaces the clusters one by one, and this one waits for its turn",
  });
export type ClusterStatus = z.infer<typeof ClusterStatusSchema>;

export const ClusterSchema = z.object({
  id: ClusterIdSchema,
  shardIds: z.array(z.number().nonnegative()).meta({
    description: "Shard IDs associated to that cluster",
  }),
  status: ClusterStatusSchema,
});
export type Cluster = z.infer<typeof ClusterSchema>;

export const ClustersSchema = z.array(ClusterSchema);

export const OutdatedClustersSchema = z.array(ClusterIdSchema).meta({
  description: "Clusters running an older image, token or environment than the saved ones",
});

export const UpdateClustersSchema = z
  .array(ClusterSchema.pick({ id: true, shardIds: true }).partial({ id: true }))
  .min(1)
  .meta({ description: "List of clusters to update or create (if id is not provided)" });
export type UpdateClusters = z.infer<typeof UpdateClustersSchema>;

export const SseIntervalQuerySchema = z.object({
  interval: z.coerce.number().positive().min(1).max(120).optional().default(5).meta({
    description: "Refresh interval in seconds",
  }),
});

export const ClusterActionSchema = z.enum(["start", "stop", "restart"]).meta({
  description: "Action to apply",
});
export type ClusterAction = z.infer<typeof ClusterActionSchema>;

export const ClusterStatsSchema = z.object({
  cpuPercentage: z.number().min(0).nonnegative().meta({
    description: "CPU usage percentage of the cluster",
  }),
  memory: z.object({
    usage: z.number().nonnegative().meta({
      description: "Number of bytes used in memory",
    }),
    percentage: z.number().min(0).nonnegative().meta({
      description: "Percentage of available memory used",
    }),
  }),
  network: z.array(
    z.object({
      interface: z.string().meta({
        description: "Networking interface name",
      }),
      transmitted: z.number().nonnegative().meta({
        description: "Number of bytes transmitted by the interface",
      }),
      received: z.number().nonnegative().meta({
        description: "Number of bytes received by the interface",
      }),
    }),
  ),
});
export type ClusterStats = z.infer<typeof ClusterStatsSchema>;

export const ClustersStatsSchema = z.record(ClusterIdSchema, ClusterStatsSchema).meta({
  description:
    "Stats of every running clusters keyed by ID (clusters whose stats failed to fetch are omitted)",
});
export type ClustersStats = z.infer<typeof ClustersStatsSchema>;

export const ClustersBulkActionResultSchema = z.object({
  succeeded: z.array(ClusterIdSchema).meta({
    description: "Successfull clusters IDs",
  }),
  failed: z
    .array(
      z.object({
        id: ClusterIdSchema,
        reason: z.string(),
      }),
    )
    .meta({
      description: "Failed clusters IDs with the reason of failure",
    }),
});
export type ClustersBulkActionResult = z.infer<typeof ClustersBulkActionResultSchema>;

export const ClusterIdParamSchema = z.object({
  id: ClusterIdSchema,
});

export const ClusterActionParamSchema = z.object({
  action: ClusterActionSchema,
});

export const ClusterIdActionParamSchema = ClusterIdParamSchema.extend(
  ClusterActionParamSchema.shape,
);

export const ClusterLogsQuerySchema = z.object({
  since: z.coerce.date().optional().meta({
    description: "At which point in time does the logs collection start",
  }),
  until: z.coerce.date().optional().meta({
    description: "At which point in time does the logs collection end",
  }),
  tail: z.coerce.number().positive().min(1).or(z.literal("all")).optional().default("all").meta({
    description: "How many logs to fetch from latest to oldest ('all' gets all the logs)",
  }),
});
export type ClusterLogsQuery = z.infer<typeof ClusterLogsQuerySchema>;

export const ClusterLogSchema = z.object({
  content: z.string().meta({
    description: "Content of a log line",
  }),
  stream: z.enum(["STDOUT", "STDERR"]).meta({
    description: "Stream that the log was published into",
  }),
  timestamp: z.string().optional().meta({
    description: "RFC3339Nano timestamp emitted by the Docker daemon for that log line",
  }),
});
export type ClusterLog = z.infer<typeof ClusterLogSchema>;

export const ClusterLogsSchema = z.array(ClusterLogSchema).meta({
  description: "Logs (line by line) of a container",
});
export type ClusterLogs = z.infer<typeof ClusterLogsSchema>;

export const ClusterStatsHistoryRangeSchema = z.enum(["1h", "6h", "24h", "7d"]).meta({
  description: "How far back the history goes",
});
export type ClusterStatsHistoryRange = z.infer<typeof ClusterStatsHistoryRangeSchema>;

export const ClusterStatsHistoryQuerySchema = z.object({
  range: ClusterStatsHistoryRangeSchema.optional().default("1h"),
});

export const ClusterStatsPointSchema = ClusterStatsSchema.pick({
  cpuPercentage: true,
  memory: true,
}).extend({
  at: z.iso.datetime().meta({ description: "Start of the period averaged by this point" }),
});
export type ClusterStatsPoint = z.infer<typeof ClusterStatsPointSchema>;

export const ClustersStatsHistorySchema = z.object({
  from: z.iso.datetime().meta({ description: "Start of the history" }),
  to: z.iso.datetime().meta({ description: "End of the history" }),
  interval: z.number().int().positive().meta({
    description: "Number of seconds averaged by each point",
  }),
  clusters: z.record(ClusterIdSchema, z.array(ClusterStatsPointSchema)).meta({
    description: "Averaged stats of every cluster keyed by ID, from the oldest to the newest point",
  }),
});
export type ClustersStatsHistory = z.infer<typeof ClustersStatsHistorySchema>;
