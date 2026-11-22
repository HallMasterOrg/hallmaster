import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import authMiddlewares from "#middlewares/auth.middlware";
import validator from "#middlewares/validator.middleware";
import { AlertsQuerySchema, AlertsSchema } from "#schemas/alert.schema";
import AlertService from "#services/alert.service";

const tags = ["Alerts"];

const alertController = new Hono().use(...authMiddlewares).get(
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
);

export default alertController;
