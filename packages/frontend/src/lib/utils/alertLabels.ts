import type { AlertKind } from "@hallmaster/backend/schemas";

const alertLabels: Record<AlertKind, string> = {
  STOPPED: "down",
  CRASH_LOOP: "crash loop",
  OOM_KILLED: "out of memory",
};

export default alertLabels;
