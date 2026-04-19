import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetClusterSchema = z.object({
  id: z.uuid().meta({
    description: 'The cluster ID.',
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
