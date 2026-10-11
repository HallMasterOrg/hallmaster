import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import z from "zod";

import authController from "#controllers/auth.controller";
import botController from "#controllers/bot.controller";
import clusterController from "#controllers/cluster.controller";
import { ValidationException } from "#exceptions/http-exceptions";
import { ApiErrorSchema, type ApiError } from "#schemas/error.schema";

const app = new Hono();

app.use("/api/*", logger());

app.onError((error, c) => {
  if (error instanceof ValidationException) {
    return c.json(
      { message: error.message, issues: error.issues } satisfies ApiError,
      error.status,
    );
  }

  if (error instanceof HTTPException) {
    const authenticate = error.res?.headers.get("WWW-Authenticate");
    if (authenticate) {
      c.header("WWW-Authenticate", authenticate);
    }

    return c.json({ message: error.message } satisfies ApiError, error.status);
  }

  console.error(error);

  return c.json({ message: "Internal Server Error" } satisfies ApiError, 500);
});

app.notFound((c) => c.json({ message: "Route not found" } satisfies ApiError, 404));

app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    defaultValidationErrorResponse: {
      description: "Bad Request",
      content: {
        "application/json": {
          schema: z.toJSONSchema(ApiErrorSchema) as Record<string, unknown>,
        },
      },
    },
    documentation: {
      info: {
        title: "Hallmaster API Documentation",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  }),
);

app.get(
  "/docs",
  Scalar({
    theme: "saturn",
    url: "/openapi.json",
    agent: { disabled: true },
    mcp: { disabled: true },
  }),
);

const routes = app
  .route("/api/auth", authController)
  .route("/api/bot", botController)
  .route("/api/clusters", clusterController);

export default app;
export type AppType = typeof routes;
