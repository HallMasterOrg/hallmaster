import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ClusterBulkActionResultSchema = z.object({
  succeeded: z.array(z.number().int().nonnegative()).meta({
    description: 'IDs of clusters where the action completed successfully.',
  }),
  failed: z
    .array(
      z.object({
        id: z.number().int().nonnegative(),
        reason: z.string(),
      }),
    )
    .meta({
      description: 'Clusters where the action failed, along with the failure reason.',
    }),
});

export class ClusterBulkActionResultZodDto extends createZodDto(ClusterBulkActionResultSchema) {}

export type ClusterBulkActionResultDto = z.infer<typeof ClusterBulkActionResultSchema>;
