import z from 'zod';

export const loginSchema = z.object({
  username: z.string().meta({
    description: "The user's username.",
  }),
  password: z.string().meta({
    description: "The user's password.",
  }),
});

export type Login = z.infer<typeof loginSchema>;
