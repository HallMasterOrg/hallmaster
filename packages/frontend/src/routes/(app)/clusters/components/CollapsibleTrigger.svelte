<script lang="ts">
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { ChevronRightIcon } from "@lucide/svelte";
  import { Collapsible } from "@skeletonlabs/skeleton-svelte";

  interface Props {
    cluster: GetClusterDto;
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
      "animate-pulse preset-filled-primary-500": cluster.status === "STARTING",
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
