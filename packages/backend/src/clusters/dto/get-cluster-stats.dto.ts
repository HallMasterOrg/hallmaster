import { createZodDto } from 'nestjs-zod';
import z from 'zod';

const GetClusterStatsProcessesUsageSchema = z.object({
  usage: z.number().meta({
    description: 'The number of processes running in the cluster.',
  }),
  percentage: z.number().meta({
    description:
      'The number of running processes in the cluster over the limit.',
  }),
});

const GetClusterStatsMemoryUsageSchema = z.object({
  usage: z.number().meta({
    description: 'The number of bytes used in memory.',
  }),
  percentage: z.number().meta({
    description: 'The percentage of the available memory used by the cluster.',
  }),
});

const GetClusterStatsNetworkSchema = z.object({
  interface: z.string().meta({
    description: 'The networking interface name.',
  }),
  transmitted: z.number().meta({
    description: 'The number of bytes transmitted by the interface.',
  }),
  received: z.number().meta({
    description: 'The number of bytes received by the interface.',
  }),
});

const GetClusterStatsDiskSchema = z.object({
  read: z.number().nullable().meta({
    description:
      'The number of bytes read from disk. The value is null if no disk interface is detected.',
  }),
  write: z.number().nullable().meta({
    description:
      'The number of bytes written to disk. The value is null if no disk interface is detected.',
  }),
});

export const GetClusterStatsSchema = z.object({
  cpuPercentage: z.number().meta({
    description: 'The percentage of CPU utilization.',
  }),
  processes: GetClusterStatsProcessesUsageSchema,
  memory: GetClusterStatsMemoryUsageSchema,
  disk: GetClusterStatsDiskSchema,
  networks: z.array(GetClusterStatsNetworkSchema).meta({
    description:
      'The usage of each detected networking interface in the cluster.',
  }),
});

export class GetClusterStatsZodDto extends createZodDto(
  GetClusterStatsSchema,
) {}

export type GetClusterStatsDto = z.infer<typeof GetClusterStatsSchema>;
