import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const GetClusterLogsQuerySchema = z.object({
  since: z.iso.datetime().optional().meta({
    description: 'At which point in time does the logs collection start.',
  }),
  until: z.iso.datetime().optional().meta({
    description: 'At which point in time does the logs collection end.',
  }),
  tail: z.coerce.number().positive().min(1).or(z.literal('all')).optional().default('all').meta({
    description: "How many logs to fetch, from latest to oldest. 'all' gets all the logs.",
  }),
});

export class GetClusterLogsQueryZodDto extends createZodDto(GetClusterLogsQuerySchema) {}

export type GetClusterLogsQueryDto = z.infer<typeof GetClusterLogsQuerySchema>;

export const GetClusterLogSchema = z.object({
  content: z.string().meta({
    description: 'The content of a log line.',
  }),
  stream: z.union([z.literal('STDOUT'), z.literal('STDERR')]).meta({
    description: 'The stream that the log was published into.',
  }),
});

export const GetClusterLogsSchema = z.array(GetClusterLogSchema).meta({
  description: 'Logs (line by line) of a container.',
});

export class GetClusterLogsZodDto extends createZodDto(GetClusterLogsSchema) {}

export type GetClusterLogsDto = z.infer<typeof GetClusterLogsSchema>;
