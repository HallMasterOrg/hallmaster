import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import authMiddlewares from "#middlewares/auth.middlware";
import validator from "#middlewares/validator.middleware";
import { AlertWebhookSchema, UpdateAlertWebhookSchema } from "#schemas/alert-webhook.schema";
import { AlertsQuerySchema, AlertsSchema } from "#schemas/alert.schema";
import { ApiErrorSchema } from "#schemas/error.schema";
import AlertWebhookService from "#services/alert-webhook.service";
import AlertService from "#services/alert.service";

const tags = ["Alerts"];

const webhookResponse = {
  description: "OK",
  content: { "application/json": { schema: resolver(AlertWebhookSchema) } },
};

const botNotFound = {
  description: "Not Found",
  content: {
    "application/json": {
      schema: resolver(ApiErrorSchema),
      example: { message: "Bot not found" },
    },
  },
};

const alertController = new Hono()
  .use(...authMiddlewares)
  .get(
    "/",
    describeRoute({
      tags,
      description: "Get the alerts raised on the clusters",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(AlertsSchema) },
          },
        },
      },
    }),
    validator("query", AlertsQuerySchema),
    async (c) => {
      const alerts = await AlertService.getAll(c.req.valid("query"));

      return c.json(alerts, 200);
    },
  )
  .get(
    "/webhook",
    describeRoute({
      tags,
      description: "Get the Discord webhook the alerts are posted to, without its token",
      responses: { 200: webhookResponse, 404: botNotFound },
    }),
    async (c) => {
      const webhook = await AlertWebhookService.get();

      return c.json(webhook, 200);
    },
  )
  .put(
    "/webhook",
    describeRoute({
      tags,
      description: "Set the Discord webhook the alerts are posted to",
      responses: {
        200: webhookResponse,
        400: {
          description: "Bad Request",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: {
                message: "Validation failed",
                issues: [{ path: "url", message: "Paste the URL of a Discord webhook" }],
              },
            },
          },
        },
        404: botNotFound,
      },
    }),
    validator("json", UpdateAlertWebhookSchema),
    async (c) => {
      const webhook = await AlertWebhookService.update(c.req.valid("json"));

      return c.json(webhook, 200);
    },
  )
  .delete(
    "/webhook",
    describeRoute({
      tags,
      description: "Stop posting the alerts to Discord and forget the webhook",
      responses: { 200: webhookResponse, 404: botNotFound },
    }),
    async (c) => {
      const webhook = await AlertWebhookService.remove();

      return c.json(webhook, 200);
    },
  )
  .post(
    "/webhook/test",
    describeRoute({
      tags,
      description: "Post a test message to the Discord webhook, with the configured mentions",
      responses: {
        200: webhookResponse,
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              examples: {
                "No bot": { value: { message: "Bot not found" } },
                "No webhook": { value: { message: "Alert webhook not found" } },
              },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              examples: {
                "Unknown webhook": {
                  value: { message: "Discord does not know this webhook anymore, paste a new URL" },
                },
                "Rate limited": { value: { message: "Discord is rate limiting the webhook" } },
                Unreachable: { value: { message: "Discord API is unreachable or timed out" } },
              },
            },
          },
        },
      },
    }),
    async (c) => {
      const webhook = await AlertWebhookService.test();

      return c.json(webhook, 200);
    },
  );

export default alertController;
