import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import authMiddlewares, { ownerOnly, type AuthEnv } from "#middlewares/auth.middlware";
import validator from "#middlewares/validator.middleware";
import { ApiErrorSchema } from "#schemas/error.schema";
import { AddUserSchema, UserIdParamSchema, UserSchema, UsersSchema } from "#schemas/user.schema";
import UserService from "#services/user.service";

const tags = ["Users"];

const forbidden = {
  description: "Forbidden",
  content: {
    "application/json": {
      schema: resolver(ApiErrorSchema),
      example: { message: "Only the owner can manage the admins" },
    },
  },
};

const notFound = {
  description: "Not Found",
  content: {
    "application/json": {
      schema: resolver(ApiErrorSchema),
      example: { message: "User not found" },
    },
  },
};

const userController = new Hono<AuthEnv>()
  .use(...authMiddlewares)
  .get(
    "/",
    describeRoute({
      tags,
      description: "List the users who can access the instance",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(UsersSchema) },
          },
        },
      },
    }),
    async (c) => c.json(await UserService.getAll()),
  )
  .post(
    "/",
    describeRoute({
      tags,
      description: "Give a Discord account admin access to the instance",
      responses: {
        201: {
          description: "Created",
          content: {
            "application/json": { schema: resolver(UserSchema) },
          },
        },
        400: {
          description: "Bad Request",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "No Discord user has this ID" },
            },
          },
        },
        403: forbidden,
        409: {
          description: "Conflict",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "This Discord account can already log in" },
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
    ownerOnly,
    validator("json", AddUserSchema),
    async (c) => {
      const { id } = c.req.valid("json");
      const user = await UserService.addAdmin(id);

      return c.json(user, 201);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      tags,
      description: "Remove the access of an admin",
      responses: {
        204: { description: "No Content" },
        400: {
          description: "Bad Request",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "The owner cannot be removed" },
            },
          },
        },
        403: forbidden,
        404: notFound,
      },
    }),
    ownerOnly,
    validator("param", UserIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      await UserService.removeAdmin(id);

      return c.body(null, 204);
    },
  )
  .post(
    "/:id/ownership",
    describeRoute({
      tags,
      description: "Make an admin the owner of the instance. The current owner becomes an admin",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": { schema: resolver(UsersSchema) },
          },
        },
        400: {
          description: "Bad Request",
          content: {
            "application/json": {
              schema: resolver(ApiErrorSchema),
              example: { message: "This user is already the owner" },
            },
          },
        },
        403: forbidden,
        404: notFound,
      },
    }),
    ownerOnly,
    validator("param", UserIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const users = await UserService.transferOwnership(c.get("user"), id);

      return c.json(users);
    },
  );

export default userController;
