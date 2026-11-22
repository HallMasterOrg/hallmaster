import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import validator from "#middlewares/validator.middleware";
import webhookMiddlewares from "#middlewares/webhook.middleware";
import { ApiErrorSchema } from "#schemas/error.schema";
import { DeploymentIdSchema, DeploymentSchema, DeployWebhookSchema } from "#schemas/webhook.schema";
import DeploymentService from "#services/deployment.service";

const tags = ["Webhooks"];

const webhookController = new Hono()
  .use(...webhookMiddlewares)
  .post(
    "/deploy",
    describeRoute({
      tags,
      description:
        "Pull a new tag of the registered image, then replace the clusters with it one by one in the background. Meant to be called by a CI once the image is pushed, then followed with GET /api/webhooks/deployments/{id}.",
      responses: {
        202: {
          description: "Deployment started",
          content: {
            "application/json": { schema: resolver(DeploymentSchema) },
          },
        },
        404: {
          description:
            "The tag is not in the registry: it was not pushed (or not fully pushed) yet, or it has a typo",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Image registry.example.com:5000/bot:3f2c1a9 not found" },
            },
          },
        },
        409: {
          description: "The bot is not set up yet, or another operation is running on the clusters",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              examples: {
                "Not set up": {
                  value: {
                    message:
                      "No container image is registered, finish the setup in the dashboard first",
                  },
                },
                Busy: {
                  value: {
                    message: "Another operation is running on the clusters, retry once it is done",
                  },
                },
              },
            },
          },
        },
        424: {
          description:
            "Docker could not pull the image, or the registry refused the saved credentials",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: {
                message:
                  "Registry registry.example.com:5000 refused the saved credentials: unauthorized: authentication required",
              },
            },
          },
        },
      },
    }),
    validator("json", DeployWebhookSchema),
    async (c) => {
      const deployment = await DeploymentService.deploy(c.req.valid("json"));

      return c.json(deployment, 202);
    },
  )
  .get(
    "/deployments/:id",
    describeRoute({
      tags,
      description: "Follow a deployment started by the webhook",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(DeploymentSchema) },
          },
        },
        404: {
          description:
            "Unknown deployment. HallMaster keeps the last 20, and forgets them when it restarts",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Deployment 0b6f6f8e-7c5e-4d55-9a8f-0f4b5a1d2c3e not found" },
            },
          },
        },
      },
    }),
    validator("param", DeploymentIdSchema),
    (c) => {
      const deployment = DeploymentService.get(c.req.valid("param").id);

      return c.json(deployment, 200);
    },
  );

export default webhookController;
