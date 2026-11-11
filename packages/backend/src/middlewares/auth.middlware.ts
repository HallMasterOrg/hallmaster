import { describeRoute, resolver } from "hono-openapi";
import { jwt } from "hono/jwt";

import env from "#lib/env";
import { ApiErrorSchema } from "#schemas/error.schema";

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
];

export default authMiddlewares;
