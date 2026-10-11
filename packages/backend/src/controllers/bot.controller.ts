import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import authMiddlewares from "#middlewares/auth.middlware";
import validator from "#middlewares/validator.middleware";
import {
  BotDiscordProfileSchema,
  BotSchema,
  ContainerImageSchema,
  CreateBotSchema,
  RecommendedShardsSchema,
} from "#schemas/bot.schema";
import { ApiErrorSchema } from "#schemas/error.schema";
import BotService from "#services/bot.service";

const tags = ["Bot"];

const botController = new Hono()
  .use(...authMiddlewares)
  .post(
    "/",
    describeRoute({
      tags,
      description: "Register a bot",
      responses: {
        201: {
          description: "Created",
          content: {
            "application/json": { schema: resolver(BotSchema) },
          },
        },
        409: {
          description: "Conflict",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "A bot is already registered" },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              examples: {
                "Unreachable or timed out": {
                  value: { message: "Discord API is unreachable or timed out" },
                },
                "Invalid token": { value: { message: "Invalid Discord bot token" } },
                Unexpected: {
                  value: { message: "Discord API returned an unexpected response body" },
                },
              },
            },
          },
        },
      },
    }),
    validator("json", CreateBotSchema),
    async (c) => {
      const data = c.req.valid("json");
      const bot = await BotService.create(data);

      return c.json(bot, 201);
    },
  )
  .get(
    "/",
    describeRoute({
      tags,
      description: "Get the registered bot",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(BotSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Bot not found" },
            },
          },
        },
      },
    }),
    async (c) => {
      const bot = await BotService.get();

      return c.json(bot);
    },
  )
  .put(
    "/",
    describeRoute({
      tags,
      description: "Update bot",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(BotSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Bot not found" },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Invalid response from the Discord API" },
            },
          },
        },
      },
    }),
    validator("json", CreateBotSchema),
    async (c) => {
      const data = c.req.valid("json");
      const bot = await BotService.update(data);

      return c.json(bot, 200);
    },
  )
  .delete(
    "/",
    describeRoute({
      tags,
      description: "Delete bot",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(BotSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Bot not found" },
            },
          },
        },
      },
    }),
    async (c) => {
      const bot = await BotService.delete();

      return c.json(bot, 200);
    },
  )
  .get(
    "/profile",
    describeRoute({
      tags,
      description: "Get bot Discord profile",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(BotDiscordProfileSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Bot not found" },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              examples: {
                "Unreachable or timed out": {
                  value: { message: "Discord API is unreachable or timed out" },
                },
                "Invalid token": { value: { message: "Invalid Discord bot token" } },
                Unexpected: {
                  value: { message: "Discord API returned an unexpected response body" },
                },
              },
            },
          },
        },
      },
    }),
    async (c) => {
      const profile = await BotService.discordProfile();

      return c.json(profile, 200);
    },
  )
  .get(
    "/recommended-shards",
    describeRoute({
      tags,
      description: "Get the number of shards recommended by Discord",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(RecommendedShardsSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Bot not found" },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              examples: {
                "Unreachable or timed out": {
                  value: { message: "Discord API is unreachable or timed out" },
                },
                "Invalid token": { value: { message: "Invalid Discord bot token" } },
                Unexpected: {
                  value: { message: "Discord API returned an unexpected response body" },
                },
              },
            },
          },
        },
      },
    }),
    async (c) => {
      const recommendedShards = await BotService.recommendedShards();

      return c.json(recommendedShards, 200);
    },
  )
  .get(
    "/container-image",
    describeRoute({
      tags,
      description: "Get the registered container image",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ContainerImageSchema.omit({ password: true })) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Container image not found" },
            },
          },
        },
      },
    }),
    async (c) => {
      const containerImage = await BotService.getContainerImage();

      return c.json(containerImage, 200);
    },
  )
  .post(
    "/container-image",
    describeRoute({
      tags,
      description: "Register a container image",
      responses: {
        201: {
          description: "Created",
          content: {
            "application/json": { schema: resolver(ContainerImageSchema.omit({ password: true })) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Bot not found" },
            },
          },
        },
        409: {
          description: "Conflict",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "A container image is already registered" },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Docker Engine API returned an unexpected response" },
            },
          },
        },
      },
    }),
    validator("json", ContainerImageSchema),
    async (c) => {
      const data = c.req.valid("json");
      const containerImage = await BotService.createContainerImage(data);

      return c.json(containerImage, 201);
    },
  )
  .put(
    "/container-image",
    describeRoute({
      tags,
      description: "Update container image",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(ContainerImageSchema.omit({ password: true })) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Container image not found" },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Docker Engine API returned an unexpected response" },
            },
          },
        },
      },
    }),
    validator("json", ContainerImageSchema),
    async (c) => {
      const data = c.req.valid("json");
      const containerImage = await BotService.updateContainerImage(data);

      return c.json(containerImage, 200);
    },
  );

export default botController;
