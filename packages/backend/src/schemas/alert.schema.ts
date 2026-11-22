import z from "zod";

import { ClusterIdSchema } from "./cluster.schema";

export const AlertKindSchema = z.enum(["STOPPED", "CRASH_LOOP", "OOM_KILLED"]).meta({
  description:
    "STOPPED: the cluster should run but does not, CRASH_LOOP: the cluster keeps exiting, OOM_KILLED: the cluster ran out of memory",
});
export type AlertKind = z.infer<typeof AlertKindSchema>;

export const AlertSchema = z.object({
  id: z.uuid().meta({ description: "Alert ID" }),
  clusterId: ClusterIdSchema,
  kind: AlertKindSchema,
  message: z.string().meta({ description: "What happened to the cluster" }),
  startedAt: z.iso.datetime().meta({ description: "When the alert was raised" }),
  resolvedAt: z.iso.datetime().nullable().meta({
    description: "When the alert was resolved, null while it is active",
  }),
});
export type Alert = z.infer<typeof AlertSchema>;

export const AlertsSchema = z.array(AlertSchema).meta({
  description: "Alerts from the most recent to the oldest, the active ones first",
});

export const AlertsQuerySchema = z.object({
  active: z.stringbool().optional().meta({
    description: "Only the active alerts (true) or only the resolved ones (false)",
  }),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100).meta({
    description: "Maximum number of alerts to return",
  }),
});
export type AlertsQuery = z.infer<typeof AlertsQuerySchema>;
