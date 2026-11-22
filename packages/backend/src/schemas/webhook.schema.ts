import z from "zod";

export const DeployWebhookSchema = z.object({
  tag: z
    .string()
    .regex(/^\w[\w.-]{0,127}$/, "Invalid image tag")
    .meta({
      description:
        "Tag of the registered image to deploy, pushed by the CI beforehand (example: 3f2c1a9)",
    }),
});
export type DeployWebhook = z.infer<typeof DeployWebhookSchema>;

export const DeploymentIdSchema = z.object({
  id: z.uuid().meta({ description: "Deployment ID" }),
});

export const DeploymentStatusSchema = z.enum(["RUNNING", "SUCCEEDED", "FAILED"]).meta({
  description:
    "RUNNING: the clusters are being replaced one by one, SUCCEEDED: every cluster runs the image, FAILED: a cluster was not ready and every cluster went back to the previous version",
});

export const DeploymentSchema = z.object({
  id: z.uuid().meta({ description: "Deployment ID" }),
  image: z.string().meta({ description: "Deployed image" }),
  status: DeploymentStatusSchema,
  message: z.string().nullable().meta({ description: "Why the deployment failed" }),
  startedAt: z.iso.datetime().meta({ description: "When the deployment started" }),
  finishedAt: z.iso
    .datetime()
    .nullable()
    .meta({ description: "When the deployment ended, null while it runs" }),
});
export type Deployment = z.infer<typeof DeploymentSchema>;
