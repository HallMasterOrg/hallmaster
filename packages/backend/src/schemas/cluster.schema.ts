import z from "zod";

export const ClusterIdSchema = z.coerce.number().int().nonnegative().meta({
  description: "Cluster ID",
});
export type ClusterId = z.infer<typeof ClusterIdSchema>;

export const ClusterSchema = z.object({
  id: ClusterIdSchema,
  shardIds: z.array(z.number().nonnegative()).meta({
    description: "Shard IDs associated to that cluster",
  }),
  status: z.enum(["STARTING", "RUNNING", "STOPPED", "ERROR", "UPDATING"]).meta({
    description: "Status of the cluster",
  }),
});
export type Cluster = z.infer<typeof ClusterSchema>;

export const ClustersSchema = z.array(ClusterSchema);

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

export const ClustersStatsSchema = z.record(ClusterIdSchema, ClusterStatsSchema).meta({
  description:
    "Stats of every running clusters keyed by ID (clusters whose stats failed to fetch are omitted)",
});

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

export const ClusterIdParamSchema = z.object({
  id: ClusterIdSchema,
});

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

export const ClusterLogsSchema = z.array(ClusterLogSchema).meta({
  description: "Logs (line by line) of a container",
});
