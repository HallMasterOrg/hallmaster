import z from "zod";

import { BotSchema } from "./bot.schema";

export const DiscordGatewayBotSchema = BotSchema.pick({ shards: true });
export type DiscordGatewayBot = z.infer<typeof DiscordGatewayBotSchema>;

export const DiscordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullable(),
  discriminator: z.string(),
  avatar: z.string().nullable(),
  banner: z.string().nullish(),
  accent_color: z.number().int().nullish(),
  bot: z.boolean().optional(),
});
export type DiscordUser = z.infer<typeof DiscordUserSchema>;

export const DiscordAccessTokenSchema = z.object({
  access_token: z.string(),
});

export const DiscordErrorSchema = z.object({
  message: z.string().optional(),
  retry_after: z.number().optional(),
});

export type DiscordEmbed = {
  title: string;
  description?: string;
  color: number;
  timestamp?: string;
  footer?: { text: string };
};

export type DiscordWebhookMessage = {
  content?: string;
  embeds: DiscordEmbed[];
  allowed_mentions: { parse: ("everyone" | "users" | "roles")[] };
};

export type DiscordWebhook = { id: string; token: string };

export type DiscordWebhookDelivery =
  | { status: "SENT" }
  | { status: "RATE_LIMITED"; reason: string; retryAfterMs: number }
  | { status: "UNAVAILABLE"; reason: string }
  | { status: "REFUSED"; reason: string };
