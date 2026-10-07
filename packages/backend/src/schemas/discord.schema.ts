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
  banner: z.string().nullable(),
  accent_color: z.number().int().nullable(),
});
