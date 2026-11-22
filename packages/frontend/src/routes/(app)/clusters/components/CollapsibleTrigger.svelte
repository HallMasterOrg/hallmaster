<script lang="ts">
  import alertLabels from "$lib/utils/alertLabels";
  import type { Alert, Cluster } from "@hallmaster/backend/schemas";
  import { BellRingIcon, ChevronRightIcon, TriangleAlertIcon } from "@lucide/svelte";
  import { Collapsible } from "@skeletonlabs/skeleton-svelte";

  interface Props {
    cluster: Cluster;
    alerts: Alert[];
    outdated: boolean;
  }

  let { cluster, alerts, outdated }: Props = $props();
</script>

<Collapsible.Trigger class="btn grow justify-start">
  <Collapsible.Indicator class="group">
    <ChevronRightIcon class="transition-transform group-data-[state=open]:rotate-90" />
  </Collapsible.Indicator>

  {#each alerts as alert (alert.id)}
    <span class="badge preset-tonal-error" title={alert.message}>
      <BellRingIcon size={14} />
      {alertLabels[alert.kind]}
    </span>
  {/each}

  {#if outdated}
    <span
      class="badge preset-tonal-warning"
      title="Runs older settings than the saved ones, redeploy it from the settings"
    >
      <TriangleAlertIcon size={14} />
      outdated
    </span>
  {/if}

  <div
    class={{
      "badge preset-filled font-extrabold transition-colors": true,
      "preset-filled-success-400-600": cluster.status === "RUNNING",
      "animate-pulse preset-filled-primary-500":
        cluster.status === "STARTING" || cluster.status === "UPDATING",
      "preset-tonal-primary": cluster.status === "WAITING",
      "preset-filled-surface-500": cluster.status === "STOPPED",
      "preset-filled-error-500": cluster.status === "ERROR",
    }}
    title={cluster.status === "WAITING"
      ? "Waits for the clusters before it to be ready"
      : undefined}
  >
    {cluster.status.toLowerCase()}
  </div>

  <p class="text-lg font-bold text-surface-700-300">
    {String(cluster.id).padStart(2, "0")}
  </p>
</Collapsible.Trigger>
