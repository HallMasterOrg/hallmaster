import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { CreateBotSchema } from './create-bot.dto.js';

export const UpdateBotSchema = CreateBotSchema.extend({
  layout: z.array(z.array(z.number().nonnegative())).min(1).meta({
    description:
      'The cluster layout. Each element is an array of shard IDs assigned to that cluster. Example: [[0, 1, 2], [3]] creates 2 clusters with 4 total shards.',
  }),
}).partial();

export class UpdateBotZodDto extends createZodDto(UpdateBotSchema) {}

export type UpdateBotDto = z.infer<typeof UpdateBotSchema>;
