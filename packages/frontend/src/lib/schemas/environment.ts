import { EnvironmentVariablesSchema } from "@hallmaster/backend/schemas";
import z from "zod";

export const EnvironmentFormSchema = z.object({
  variables: EnvironmentVariablesSchema.default([]),
});
