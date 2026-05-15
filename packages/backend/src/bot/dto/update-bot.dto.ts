import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CreateBotDockerImageSchema, CreateBotSchema } from './create-bot.dto.js';

export const LayoutClusterSchema = z.object({
  id: z.number().int().nonnegative().optional().meta({
    description: 'The cluster ID. Omit to create a new cluster (next available ID will be assigned).',
  }),
  shardIds: z.array(z.number().nonnegative()).min(1).meta({
    description: 'The shard IDs assigned to that cluster.',
  }),
});

export const UpdateBotSchema = CreateBotSchema.extend({
  layout: z.array(LayoutClusterSchema).min(1).meta({
    description:
      'The cluster layout. Each element references an existing cluster by ID (or omits it to create a new one) along with its shard IDs.',
  }),
  dockerImage: CreateBotDockerImageSchema.partial().meta({
    description: 'Partial Docker image configuration. Any provided field will be updated.',
  }),
}).partial();

export class UpdateBotZodDto extends createZodDto(UpdateBotSchema) {}

export type UpdateBotDto = z.infer<typeof UpdateBotSchema>;
