import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import authMiddlewares, { type AuthEnv } from "#middlewares/auth.middlware";
import validator from "#middlewares/validator.middleware";
import {
  DiscordAuthorizationSchema,
  DiscordAuthorizationUrlSchema,
  DiscordLoginSchema,
  UserTokenResponseSchema,
} from "#schemas/auth.schema";
import { ApiErrorSchema } from "#schemas/error.schema";
import { UserSchema } from "#schemas/user.schema";
import { AuthService } from "#services/auth.service";
import UserService from "#services/user.service";

const tags = ["Authentication"];

const authController = new Hono<AuthEnv>()
  .get(
    "/me",
    describeRoute({
      tags,
      description: "Get the Discord profile of the logged in user",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(UserSchema) },
          },
        },
      },
    }),
    ...authMiddlewares,
    (c) => c.json(UserService.toUser(c.get("user"))),
  )
  .get(
    "/discord",
    describeRoute({
      tags,
      description: "Build the Discord page asking the user to authorize the instance",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(DiscordAuthorizationUrlSchema) },
          },
        },
      },
    }),
    validator("query", DiscordAuthorizationSchema),
    (c) => {
      const query = c.req.valid("query");

      return c.json(AuthService.authorizationUrl(query));
    },
  )
  .post(
    "/discord",
    describeRoute({
      tags,
      description:
        "Log in with the code sent by Discord. The first Discord user to log in to a new instance creates its account",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(UserTokenResponseSchema) },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Invalid Discord authorization code" },
            },
          },
        },
        403: {
          description: "Forbidden",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "This Discord account cannot access this instance" },
            },
          },
        },
        424: {
          description: "Failed Dependency",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "Discord API is unreachable or timed out" },
            },
          },
        },
      },
    }),
    validator("json", DiscordLoginSchema),
    async (c) => {
      const data = c.req.valid("json");
      const token = await AuthService.login(data);

      return c.json(token);
    },
  );

export default authController;
