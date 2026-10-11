import z from "zod";

export const UserSchema = z.object({
  username: z.string().min(1).meta({ description: "User username" }),
  password: z.string().min(8).meta({ description: "User password" }),
});
export type User = z.infer<typeof UserSchema>;

export const UserTokenResponseSchema = z.object({
  token: z.jwt().meta({ description: "User session token" }),
});
export type UserTokenResponse = z.infer<typeof UserTokenResponseSchema>;
