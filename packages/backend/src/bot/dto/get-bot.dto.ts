import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GetBotSchema = z.object({
  id: z.string().meta({
    description: 'The bot ID.',
  }),
  shards: z.number().nonnegative().meta({
    description: 'The total number of shards for the bot.',
  }),
  layout: z.array(z.array(z.number().nonnegative())).meta({
    description:
      'The cluster layout. Each element is an array of shard IDs assigned to that cluster.',
  }),
});

export class GetBotZodDto extends createZodDto(GetBotSchema) {}

export type GetBotDto = z.infer<typeof GetBotSchema>;
