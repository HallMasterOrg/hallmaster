import { serve } from "@hono/node-server";

import env from "#lib/env";
import AlertService from "#services/alert.service";
import ClusterService from "#services/cluster.service";
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

ClusterService.recover().catch((error: unknown) => {
  console.error("Could not recover an interrupted deployment", error);
});

AlertService.watch();

MetricsService.start({
  intervalSeconds: env.METRICS_INTERVAL_SECONDS,
  retentionDays: env.METRICS_RETENTION_DAYS,
});
