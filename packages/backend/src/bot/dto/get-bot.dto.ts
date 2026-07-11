import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetBotDockerImageSchema = z.object({
  image: z.string().meta({
    description: 'The full Docker image URI (serverName/image:tag).',
  }),
  username: z.string().nullable().meta({
    description: 'The username used to authenticate to the Docker registry.',
  }),
});

export const GetBotLayoutClusterSchema = z.object({
  id: z.number().int().nonnegative().meta({
    description: 'The cluster ID (sequential per bot).',
  }),
  shardIds: z.array(z.number().nonnegative()).meta({
    description: 'The shard IDs assigned to that cluster.',
  }),
});

export const GetBotDiscordSchema = z.object({
  name: z.string().meta({
    description: 'The Discord username of the bot.',
  }),
  displayName: z.string().nullable().meta({
    description: 'The Discord display name (global name) of the bot, or null if none is set.',
  }),
  discriminator: z.string().meta({
    description: 'The Discord discriminator.',
  }),
  avatarUrl: z.string().nullable().meta({
    description: 'URL of the bot avatar on the Discord CDN, or null if none is set.',
  }),
  bannerUrl: z.string().nullable().meta({
    description: 'URL of the bot banner on the Discord CDN, or null if none is set.',
  }),
  accentColor: z.number().int().nullable().meta({
    description: 'The bot profile accent color as an integer (0xRRGGBB), usable as a fallback when no banner is set.',
  }),
});

export const GetBotSchema = z.object({
  id: z.string().meta({
    description: 'The bot ID.',
  }),
  shards: z.number().nonnegative().meta({
    description: 'The total number of shards for the bot.',
  }),
  layout: z.array(GetBotLayoutClusterSchema).meta({
    description: 'The cluster layout. Each element is a cluster with its ID and assigned shard IDs.',
  }),
  dockerImage: GetBotDockerImageSchema.meta({
    description: 'The Docker image configuration associated with the bot.',
  }),
  discord: GetBotDiscordSchema.nullable().optional().meta({
    description: "The bot's Discord profile.",
  }),
});

export class GetBotZodDto extends createZodDto(GetBotSchema) {}

export type GetBotDto = z.infer<typeof GetBotSchema>;
