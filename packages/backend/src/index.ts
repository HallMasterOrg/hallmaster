import { serve } from "@hono/node-server";

import env from "#lib/env";
import AlertService from "#services/alert.service";
import MetricsService from "#services/metrics.service";

import app from "./app";

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

AlertService.watch();

MetricsService.start({
  intervalSeconds: env.METRICS_INTERVAL_SECONDS,
  retentionDays: env.METRICS_RETENTION_DAYS,
});
