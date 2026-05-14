<script lang="ts">
  import type { GetClusterDto } from "@hallmaster/backend/dto";

  interface Props {
    status: GetClusterDto["status"];
  }

  let { status }: Props = $props();
</script>

<div
  class={{
    "transition-colors badge preset-filled font-extrabold": true,
    "preset-filled-success-400-600": status === "RUNNING",
    "preset-filled-primary-500 animate-pulse": status === "STARTING",
    "preset-filled-surface-500": status === "STOPPED",
    "preset-filled-error-500": status === "ERROR",
  }}
>
  {status.toLocaleLowerCase()}
</div>
