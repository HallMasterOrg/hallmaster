import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreateBotDockerImageSchema = z.object({
  image: z.string().meta({
    description:
      'The Docker image to use, following this format: hostname/repo/image:tag. (example: hallmaster/discord-bot:tag)',
  }),
  username: z.string().nullable().default(null).meta({
    description:
      'The username used to authenticate to a remote Docker registry.',
  }),
  password: z.string().nullable().default(null).meta({
    description:
      'The password used to authenticate to a remote Docker registry.',
  }),
});

export const CreateBotSchema = z.object({
  layout: z.array(z.array(z.number().nonnegative())).min(1).meta({
    description:
      'The cluster layout. Each element is an array of shard IDs assigned to that cluster. Example: [[0, 1, 2], [3]] creates 2 clusters with 4 total shards.',
  }),
  token: z.string().meta({
    description: 'The token of the Discord bot.',
  }),
  dockerImage: CreateBotDockerImageSchema.meta({
    description:
      'The information required to pull the Discord bot Docker image.',
  }),
});

export class CreateBotZodDto extends createZodDto(CreateBotSchema) {}

export type CreateBotDto = z.infer<typeof CreateBotSchema>;
