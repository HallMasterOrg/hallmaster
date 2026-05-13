import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GetClusterSchema = z.object({
  id: z.number().int().positive().meta({
    description: 'The cluster ID (sequential per bot, starting at 1).',
  }),
  shardIds: z.array(z.number()).meta({
    description: 'The shard IDs associated to that cluster.',
  }),
  status: z.enum(['STARTING', 'RUNNING', 'STOPPED', 'ERROR']).meta({
    description: 'The current status of the cluster.',
  }),
});

export class GetClusterZodDto extends createZodDto(GetClusterSchema) {}

export type GetClusterDto = z.infer<typeof GetClusterSchema>;
