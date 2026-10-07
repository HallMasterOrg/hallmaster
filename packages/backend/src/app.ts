import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { logger } from "hono/logger";

import authController from "#controllers/auth.controller";
import botController from "#controllers/bot.controller";
import clusterController from "#controllers/cluster.controller";

const app = new Hono();

app.use("/api/*", logger());

app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
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
