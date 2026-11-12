import { describeRoute, resolver } from "hono-openapi";
import { createMiddleware } from "hono/factory";
import { jwt, type JwtVariables } from "hono/jwt";

import { ForbiddenException, UnauthorizedException } from "#exceptions/http-exceptions";
import env from "#lib/env";
import type { User } from "#prisma/client";
import UserRepository from "#repositories/user.repository";
import { ApiErrorSchema } from "#schemas/error.schema";

export type AuthEnv = {
  Variables: JwtVariables<{ sub: User["id"] }> & { user: User };
};

const authMiddlewares = [
  describeRoute({
    responses: {
      401: {
        description:
          "Route is protected by an Authorization header that is either not provided or invalid",
        content: {
          "application/json": {
            schema: resolver(ApiErrorSchema),
            example: { message: "Unauthorized" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  }),
  jwt({
    secret: env.SECRET,
    alg: "HS256",
  }),
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = await UserRepository.findById(c.get("jwtPayload").sub);
    if (user === null) throw new UnauthorizedException({ message: "Unauthorized" });

    c.set("user", user);
    await next();
  }),
];

export const ownerOnly = createMiddleware<AuthEnv>(async (c, next) => {
  if (c.get("user").role !== "OWNER") {
    throw new ForbiddenException({ message: "Only the owner can manage the admins" });
  }

  await next();
});

export default authMiddlewares;
