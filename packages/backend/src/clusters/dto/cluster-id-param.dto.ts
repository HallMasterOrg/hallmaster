import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ClusterIdParamSchema = z.object({
  id: z.coerce.number().int().nonnegative().meta({
    description: 'The cluster ID (sequential per bot, starting at 0).',
  }),
});

export class ClusterIdParamZodDto extends createZodDto(ClusterIdParamSchema) {}

export type ClusterIdParamDto = z.infer<typeof ClusterIdParamSchema>;
