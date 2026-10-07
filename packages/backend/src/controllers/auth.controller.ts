import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import { UserSchema, UserTokenResponseSchema } from "#schemas/auth.schema";
import { AuthService } from "#services/auth.service";

const tags = ["Authentication"];

const authController = new Hono()
  .post(
    "/register",
    describeRoute({
      tags,
      description: "Register a new account",
      responses: {
        201: {
          description: "Created",
          content: {
            "application/json": { schema: resolver(UserTokenResponseSchema) },
          },
        },
        409: {
          description: "Conflict",
          content: {
            "text/plain": { example: "A user is already registered" },
          },
        },
      },
    }),
    validator("json", UserSchema),
    async (c) => {
      const data = c.req.valid("json");
      const token = await AuthService.register(data);

      return c.json(token, 201);
    },
  )
  .post(
    "/login",
    describeRoute({
      tags,
      description: "Log in the user",
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
            "text/plain": { example: "Invalid username or password" },
          },
        },
      },
    }),
    validator("json", UserSchema),
    async (c) => {
      const data = c.req.valid("json");
      const token = await AuthService.login(data);

      return c.json(token);
    },
  );

export default authController;
