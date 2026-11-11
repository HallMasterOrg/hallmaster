import z from "zod";

export const StatusSchema = z.object({
  hasUser: z.boolean().meta({
    description: "An account is registered",
  }),
  hasBot: z.boolean().meta({
    description: "A bot and its container image are registered",
  }),
});
export type Status = z.infer<typeof StatusSchema>;
