import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GetBotDockerImageSchema = z.object({
  image: z.string().meta({
    description: 'The full Docker image URI (serverName/image:tag).',
  }),
  username: z.string().nullable().meta({
    description: 'The username used to authenticate to the Docker registry.',
  }),
});

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
  dockerImage: GetBotDockerImageSchema.meta({
    description: 'The Docker image configuration associated with the bot.',
  }),
});

export class GetBotZodDto extends createZodDto(GetBotSchema) {}

export type GetBotDto = z.infer<typeof GetBotSchema>;
