import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GetBotSchema = z.object({
  id: z.string().meta({
    description: 'The bot ID.',
  }),
  clusters: z.number().positive().meta({
    description: 'The number of clusters allocated for the bot.',
  }),
  shards: z.number().positive().meta({
    description: 'The number of shards allocated for the bot.',
  }),
});

export class GetBotZodDto extends createZodDto(GetBotSchema) {}

export type GetBotDto = z.infer<typeof GetBotSchema>;
