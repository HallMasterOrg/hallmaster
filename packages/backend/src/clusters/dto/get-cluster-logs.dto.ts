import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const GetClusterLogsSchema = z.object({
  since: z.iso.datetime().optional().meta({
    description: 'At which point in time does the logs collection start.',
  }),
  until: z.iso.datetime().optional().meta({
    description: 'At which point in time does the logs collection end.',
  }),
  tail: z.coerce
    .number()
    .positive()
    .min(1)
    .or(z.literal('all'))
    .optional()
    .default('all')
    .meta({
      description:
        "How many logs to fetch, from latest to oldest. 'all' gets all the logs.",
    }),
});

export class GetClusterLogsZodDto extends createZodDto(GetClusterLogsSchema) {}

export type GetClusterLogsDto = z.infer<typeof GetClusterLogsSchema>;
