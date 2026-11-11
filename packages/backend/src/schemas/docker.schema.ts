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
