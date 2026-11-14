import z from "zod";

export const RESERVED_ENVIRONMENT_KEYS = ["DISCORD_BOT_TOKEN", "TOTAL_SHARDS", "SHARD_ID_LIST"];

export const EnvironmentVariableSchema = z.object({
  key: z
    .string()
    .regex(
      /^[A-Za-z_][A-Za-z0-9_]*$/,
      "Use letters, digits and underscores, not starting with a digit",
    )
    .max(256)
    .refine((key) => !RESERVED_ENVIRONMENT_KEYS.includes(key), "Set by HallMaster on every cluster")
    .meta({ description: "Name of the variable" }),
  value: z.string().max(32_768).meta({ description: "Value of the variable" }),
});
export type EnvironmentVariable = z.infer<typeof EnvironmentVariableSchema>;

export const EnvironmentVariablesSchema = z
  .array(EnvironmentVariableSchema)
  .max(500)
  .superRefine((variables, context) => {
    const keys = new Set<string>();

    for (const [index, { key }] of variables.entries()) {
      if (keys.has(key)) {
        context.addIssue({ code: "custom", path: [index, "key"], message: `${key} is set twice` });
      }

      keys.add(key);
    }
  })
  .meta({ description: "Environment variables given to every cluster of the bot" });
export type EnvironmentVariables = z.infer<typeof EnvironmentVariablesSchema>;
