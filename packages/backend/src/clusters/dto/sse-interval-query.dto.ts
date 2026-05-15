import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SseIntervalQuerySchema = z.object({
  interval: z.coerce.number().positive().min(1).max(120).optional().default(5).meta({
    description: 'Refresh interval in seconds (1–120). Defaults to 5.',
  }),
});

export class SseIntervalQueryZodDto extends createZodDto(SseIntervalQuerySchema) {}
