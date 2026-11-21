import "dotenv/config";
import z from "zod";

const EnvironmentSchema = z.object({
  SECRET: z.string(),
  PORT: z.coerce.number().int().positive().default(3000),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_URL: z.url().default("https://discord.com"),
});

const env = EnvironmentSchema.parse(process.env);
export default env;
