import z from "zod";

const EnvironmentSchema = z.object({
  SECRET: z.string(),
});

const env = EnvironmentSchema.parse(process.env);
export default env;
