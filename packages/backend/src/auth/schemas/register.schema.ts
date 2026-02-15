import z from 'zod';

export const registerSchema = z.object({
  username: z.string().meta({
    description: "The user's username.",
  }),
  password: z.string().meta({
    description: "The user's password.",
  }),
});

export type Register = z.infer<typeof registerSchema>;
