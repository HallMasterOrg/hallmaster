import z from 'zod';

export const registerSchema = z.object({
  username: z.string().min(1).meta({
    description: "The user's username.",
  }),
  password: z.string().min(8).meta({
    description: "The user's password.",
  }),
});

export type Register = z.infer<typeof registerSchema>;
