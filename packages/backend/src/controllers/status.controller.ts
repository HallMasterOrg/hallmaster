import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import { StatusSchema } from "#schemas/status.schema";
import StatusService from "#services/status.service";

const tags = ["Status"];

// Public on purpose: the dashboard reads it before anyone is logged in, to send a new
// instance to the setup page.
const statusController = new Hono().get(
  "/",
  describeRoute({
    tags,
    description: "Tell how far the onboarding of this instance went",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": { schema: resolver(StatusSchema) },
        },
      },
    },
  }),
  async (c) => {
    const status = await StatusService.get();

    return c.json(status, 200);
  },
);

export default statusController;
