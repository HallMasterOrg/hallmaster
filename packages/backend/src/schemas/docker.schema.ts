import z from "zod";

const DockerCpuStatsSchema = z
  .object({
    cpu_usage: z.object({ total_usage: z.number().default(0) }).prefault({}),
    system_cpu_usage: z.number().default(0),
    online_cpus: z.number().default(1),
  })
  .prefault({});
export type DockerCpuStats = z.infer<typeof DockerCpuStatsSchema>;

export const DockerContainerStatsSchema = z.object({
  cpu_stats: DockerCpuStatsSchema,
  precpu_stats: DockerCpuStatsSchema,
  memory_stats: z
    .object({
      usage: z.number().default(0),
      limit: z.number().default(0),
      stats: z.object({ inactive_file: z.number().default(0) }).prefault({}),
    })
    .prefault({}),
  networks: z
    .record(z.string(), z.object({ rx_bytes: z.number(), tx_bytes: z.number() }))
    .default({}),
});
export type DockerContainerStats = z.infer<typeof DockerContainerStatsSchema>;

export const DockerEventActionSchema = z.enum(["die", "start", "restart", "oom", "destroy"]);
export type DockerEventAction = z.infer<typeof DockerEventActionSchema>;

export const DockerEventSchema = z.object({
  Action: DockerEventActionSchema,
  Actor: z.object({
    ID: z.string(),
    Attributes: z.object({ exitCode: z.string().default("unknown") }).prefault({}),
  }),
  timeNano: z.number(),
});
export type DockerEvent = z.infer<typeof DockerEventSchema>;

export const DockerEventLineSchema = z
  .string()
  .transform((line, context) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      context.issues.push({ code: "custom", message: "Invalid JSON", input: line });
      return z.NEVER;
    }
  })
  .pipe(DockerEventSchema);
