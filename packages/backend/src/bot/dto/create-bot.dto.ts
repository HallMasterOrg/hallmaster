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
  clusters: z.number().positive().optional().default(1).meta({
    description: 'The number of clusters allocated for the bot.',
  }),
  shards: z.number().positive().optional().default(1).meta({
    description: 'The total number of shards for the bot.',
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
