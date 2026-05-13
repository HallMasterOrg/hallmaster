import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  CreateBotDockerImageSchema,
  CreateBotSchema,
} from './create-bot.dto.js';

export const UpdateBotSchema = CreateBotSchema.extend({
  layout: z.array(z.array(z.number().nonnegative())).min(1).meta({
    description:
      'The cluster layout. Each element is an array of shard IDs assigned to that cluster. Example: [[0, 1, 2], [3]] creates 2 clusters with 4 total shards.',
  }),
  dockerImage: CreateBotDockerImageSchema.partial().meta({
    description:
      'Partial Docker image configuration. Any provided field will be updated.',
  }),
}).partial();

export class UpdateBotZodDto extends createZodDto(UpdateBotSchema) {}

export type UpdateBotDto = z.infer<typeof UpdateBotSchema>;
