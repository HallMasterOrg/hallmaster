import { describeRoute, resolver } from "hono-openapi";
import { createMiddleware } from "hono/factory";

import { ApiErrorSchema } from "#schemas/error.schema";
import BotService from "#services/bot.service";

const webhookMiddlewares = [
  describeRoute({
    responses: {
      401: {
        description: "The webhook token is missing or wrong",
        content: {
          "application/json": {
            schema: resolver(ApiErrorSchema),
            example: { message: "Invalid webhook token" },
          },
        },
      },
      403: {
        description: "No webhook token is generated yet, the webhook is disabled",
        content: {
          "application/json": {
            schema: resolver(ApiErrorSchema),
            example: {
              message:
                "The webhook is disabled, generate a token in the dashboard settings to enable it",
            },
          },
        },
      },
    },
    security: [{ webhookToken: [] }],
  }),
  createMiddleware(async (c, next) => {
    await BotService.authorizeWebhook(c.req.header("Authorization")?.match(/^Bearer (.+)$/)?.[1]);

    await next();
  }),
];

export default webhookMiddlewares;
