import { z } from 'zod';

export const userTokenSchema = z.object({
  token: z.jwt().meta({
    description: 'The user session token.',
  }),
});

export type UserToken = z.infer<typeof userTokenSchema>;
