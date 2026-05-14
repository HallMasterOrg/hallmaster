import { z } from 'zod';

export const userTokenDataSchema = z.object({
  username: z.string().meta({ description: "The authenticated user's username." }),
});

export type UserTokenData = z.infer<typeof userTokenDataSchema>;
