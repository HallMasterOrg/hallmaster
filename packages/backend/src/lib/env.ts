import "dotenv/config";
import z from "zod";

const EnvironmentSchema = z.object({
  SECRET: z.string(),
  PORT: z.coerce.number().int().positive().default(3000),
});

const env = EnvironmentSchema.parse(process.env);
export default env;
