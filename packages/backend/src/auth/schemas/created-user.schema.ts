import z from 'zod';

export const createdUserSchema = z.object({
  username: z
    .string()
    .meta({ description: 'The username of the created user.' }),
});

export type CreatedUser = z.infer<typeof createdUserSchema>;
