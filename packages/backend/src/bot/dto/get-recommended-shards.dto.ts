import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GetRecommendedShardsBodySchema = z.object({
  token: z.string().meta({
    description: 'The Discord bot token.',
  }),
});

export class GetRecommendedShardsBodyZodDto extends createZodDto(
  GetRecommendedShardsBodySchema,
) {}

export const GetRecommendedShardsSchema = z.object({
  shards: z.number().positive().meta({
    description: 'The recommended number of shards for the bot.',
  }),
});

export class GetRecommendedShardsZodDto extends createZodDto(
  GetRecommendedShardsSchema,
) {}
