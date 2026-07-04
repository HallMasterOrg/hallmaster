import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ApiErrorIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])).meta({
    description: 'Path to the field that failed validation (e.g. ["interval"]).',
  }),
  message: z.string().meta({
    description: 'A human-readable reason the field is invalid (e.g. "Expected number").',
  }),
  code: z.string().meta({
    description: 'The Zod issue code (e.g. "invalid_type").',
  }),
});

export const ApiErrorSchema = z.object({
  statusCode: z.number().int().meta({
    description: 'The HTTP status code of the error.',
  }),
  error: z.string().meta({
    description: 'The short reason phrase associated with the status code (e.g. "Bad Request").',
  }),
  message: z.string().meta({
    description: 'A human-readable description of what went wrong.',
  }),
  issues: z.array(ApiErrorIssueSchema).optional().meta({
    description: 'Field-level validation errors. Present only when the request failed schema validation.',
  }),
});

export class ApiErrorZodDto extends createZodDto(ApiErrorSchema) {}

export type ApiErrorDto = z.infer<typeof ApiErrorSchema>;
