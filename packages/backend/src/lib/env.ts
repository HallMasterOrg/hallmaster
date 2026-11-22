import "dotenv/config";
import z from "zod";

const EnvironmentSchema = z.object({
  SECRET: z.string(),
  PORT: z.coerce.number().int().positive().default(3000),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_URL: z.url().default("https://discord.com"),
  METRICS_INTERVAL_SECONDS: z.coerce.number().int().positive().default(15),
  METRICS_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  CLUSTER_READY_DELAY_SECONDS: z.coerce.number().int().nonnegative().default(10),
  CLUSTER_READY_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),
});

const env = EnvironmentSchema.parse(process.env);
export default env;
