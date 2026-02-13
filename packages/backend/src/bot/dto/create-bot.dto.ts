import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreateBotSchema = z.object({
  clusters: z.number().positive().optional().default(1).meta({
    description: 'The number of clusters allocated for the bot.',
  }),
  shards: z.number().positive().optional().default(1).meta({
    description: 'The total number of shards for the bot.',
  }),
});

export class CreateBotZodDto extends createZodDto(CreateBotSchema) {}

export type CreateBotDto = z.infer<typeof CreateBotSchema>;
