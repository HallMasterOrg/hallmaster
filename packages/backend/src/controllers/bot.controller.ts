import { BotSchema, ContainerImageSchema, CreateBotSchema } from "#schemas/bot.schema";
import { DiscordUserSchema } from "#schemas/discord.schema";
import BotService from "#services/bot.service";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import authMiddlewares from "../middlewares/auth.middlware";

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
            "text/plain": {
              example: "A bot is already registered",
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              examples: {
                "Unreachable or timed out": { value: "Discord API is unreachable or timed out" },
                "Invalid token": { value: "Invalid Discord bot token" },
                Unexpected: { value: "Discord API returned an unexpected response body" },
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
            "text/plain": { example: "Bot not found" },
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
            "text/plain": { example: "Bot not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Invalid response from the Discord API",
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
            "text/plain": { example: "Bot not found" },
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
            "application/json": { schema: resolver(DiscordUserSchema) },
          },
        },
        404: {
          description: "Not Found",
          content: {
            "text/plain": { example: "Bot not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              examples: {
                "Unreachable or timed out": { value: "Discord API is unreachable or timed out" },
                "Invalid token": { value: "Invalid Discord bot token" },
                Unexpected: { value: "Discord API returned an unexpected response body" },
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
            "text/plain": { example: "Container image not found" },
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
            "text/plain": { example: "Bot not found" },
          },
        },
        409: {
          description: "Conflict",
          content: {
            "text/plain": {
              example: "A container image is already registered",
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
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
            "text/plain": { example: "Container image not found" },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "text/plain": {
              example: "Docker Engine API returned an unexpected response",
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
