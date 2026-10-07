import env from "#lib/env";
import { describeRoute } from "hono-openapi";
import { jwt } from "hono/jwt";

const authMiddlewares = [
  describeRoute({
    responses: {
      401: {
        description:
          "Route is protected by an Authorization header that is either not provided or invalid",
        content: {
          "text/plain": { example: "Unauthorized" },
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
