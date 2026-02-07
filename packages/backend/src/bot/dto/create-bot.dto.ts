import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreateBotSchema = z.object({
  clusters: z.number().positive().default(1).optional().meta({
    description: 'The number of clusters allocated for the bot.',
  }),
  shards: z.number().positive().default(1).optional().meta({
    description: 'The total number of shards for the bot.',
  }),
});

export class CreateBotDto extends createZodDto(CreateBotSchema) {}
