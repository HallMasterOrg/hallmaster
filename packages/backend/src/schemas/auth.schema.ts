import z from "zod";

export const DiscordAuthorizationSchema = z.object({
  redirectUri: z.url().meta({ description: "Page Discord sends the user back to" }),
  state: z.string().min(1).meta({ description: "Value Discord sends back unchanged" }),
});
export type DiscordAuthorization = z.infer<typeof DiscordAuthorizationSchema>;

export const DiscordAuthorizationUrlSchema = z.object({
  url: z.url().meta({ description: "Discord page asking the user to authorize the instance" }),
});
export type DiscordAuthorizationUrl = z.infer<typeof DiscordAuthorizationUrlSchema>;

export const DiscordLoginSchema = z.object({
  code: z.string().min(1).meta({ description: "Authorization code sent by Discord" }),
  redirectUri: z.url().meta({ description: "Redirect URI the code was sent to" }),
});
export type DiscordLogin = z.infer<typeof DiscordLoginSchema>;

export const UserTokenResponseSchema = z.object({
  token: z.jwt().meta({ description: "User session token" }),
});
export type UserTokenResponse = z.infer<typeof UserTokenResponseSchema>;
