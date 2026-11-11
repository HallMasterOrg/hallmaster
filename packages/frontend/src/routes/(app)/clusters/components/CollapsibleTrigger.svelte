<script lang="ts">
  import type { Cluster } from "@hallmaster/backend/schemas";
  import { ChevronRightIcon } from "@lucide/svelte";
  import { Collapsible } from "@skeletonlabs/skeleton-svelte";

  interface Props {
    cluster: Cluster;
  }

  let { cluster }: Props = $props();
</script>

<Collapsible.Trigger class="btn grow justify-start">
  <Collapsible.Indicator class="group">
    <ChevronRightIcon class="transition-transform group-data-[state=open]:rotate-90" />
  </Collapsible.Indicator>

  <div
    class={{
      "badge preset-filled font-extrabold transition-colors": true,
      "preset-filled-success-400-600": cluster.status === "RUNNING",
      "animate-pulse preset-filled-primary-500":
        cluster.status === "STARTING" || cluster.status === "UPDATING",
      "preset-filled-surface-500": cluster.status === "STOPPED",
      "preset-filled-error-500": cluster.status === "ERROR",
    }}
  >
    {cluster.status.toLowerCase()}
  </div>

  <p class="text-lg font-bold text-surface-700-300">
    {String(cluster.id).padStart(2, "0")}
  </p>
</Collapsible.Trigger>
