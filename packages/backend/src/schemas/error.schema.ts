import z from "zod";

export const ApiIssueSchema = z.object({
  path: z.string().meta({ description: "Dot-separated path of the invalid field" }),
  message: z.string().meta({ description: "Reason why the field is invalid" }),
});
export type ApiIssue = z.infer<typeof ApiIssueSchema>;

export const ApiErrorSchema = z.object({
  message: z.string().meta({ description: "Error message" }),
  issues: z.array(ApiIssueSchema).optional().meta({
    description: "Invalid fields, only present on validation errors",
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
