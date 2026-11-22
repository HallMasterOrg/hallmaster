<script lang="ts">
  import BoundaryFailed from "$lib/components/BoundaryFailed.svelte";
  import { getAlerts } from "$lib/remotes/alerts.remote";
  import alertLabels from "$lib/utils/alertLabels";
  import formatDuration from "$lib/utils/formatDuration";
  import type { Alert } from "@hallmaster/backend/schemas";
  import { BellRingIcon, CircleCheckIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  const alerts = getAlerts();
  let now = $state(Date.now());

  onMount(() => {
    const interval = setInterval(() => {
      now = Date.now();
      void alerts.refresh();
    }, 5_000);

    return () => clearInterval(interval);
  });
</script>

{#snippet row(alert: Alert)}
  {@const startedAt = Date.parse(alert.startedAt)}
  {@const resolvedAt = alert.resolvedAt === null ? undefined : Date.parse(alert.resolvedAt)}

  <li
    class="flex flex-wrap items-center gap-x-3 gap-y-1 card border border-surface-200-800 preset-filled-surface-100-900 px-4 py-2"
  >
    <span
      class={[
        "badge font-bold",
        resolvedAt === undefined ? "preset-filled-error-500" : "preset-tonal-surface",
      ]}
    >
      {#if resolvedAt === undefined}
        <BellRingIcon size={14} />
      {:else}
        <CircleCheckIcon size={14} />
      {/if}
      {alertLabels[alert.kind]}
    </span>

    <p class="font-bold text-surface-700-300">
      Cluster {String(alert.clusterId).padStart(2, "0")}
    </p>
    <p class="grow text-sm text-surface-700-300">{alert.message}</p>

    <time class="text-xs text-surface-600-400" datetime={alert.startedAt}>
      {#if resolvedAt === undefined}
        for {formatDuration(now - startedAt)}
      {:else}
        {formatDuration(now - startedAt)} ago
        {#if resolvedAt > startedAt}
          · lasted {formatDuration(resolvedAt - startedAt)}
        {/if}
      {/if}
    </time>
  </li>
{/snippet}

<svelte:boundary>
  <section class="flex flex-col gap-2" aria-labelledby="active-alerts">
    <h6 id="active-alerts" class="h6">Active</h6>
    <ul class="flex flex-col gap-2">
      {#each (await alerts).filter(({ resolvedAt }) => resolvedAt === null) as alert (alert.id)}
        {@render row(alert)}
      {:else}
        <li
          class="card border border-dashed border-surface-300-700 p-4 text-center text-sm text-surface-700-300"
        >
          Every cluster is fine
        </li>
      {/each}
    </ul>
  </section>

  <section class="flex flex-col gap-2" aria-labelledby="alerts-history">
    <h6 id="alerts-history" class="h6">History</h6>
    <ul class="flex flex-col gap-2">
      {#each (await alerts).filter(({ resolvedAt }) => resolvedAt !== null) as alert (alert.id)}
        {@render row(alert)}
      {:else}
        <li
          class="card border border-dashed border-surface-300-700 p-4 text-center text-sm text-surface-700-300"
        >
          No alert yet
        </li>
      {/each}
    </ul>
  </section>

  {#snippet pending()}
    {#each { length: 4 }}
      <div class="h-12 placeholder animate-pulse"></div>
    {/each}
  {/snippet}

  {#snippet failed(error, reset)}
    <BoundaryFailed {error} {reset} />
  {/snippet}
</svelte:boundary>
