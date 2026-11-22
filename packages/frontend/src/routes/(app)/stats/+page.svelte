<script lang="ts">
  import { page } from "$app/state";
  import LiveQueryPing from "$lib/components/LiveQueryPing.svelte";
  import { getClustersStatsLive } from "$lib/remotes/clusters.remote";
  import { ClusterStatsHistoryRangeSchema } from "@hallmaster/backend/schemas";

  import CPU from "./components/CPU.svelte";
  import History from "./components/History.svelte";
  import Memory from "./components/Memory.svelte";

  let range = $derived(
    ClusterStatsHistoryRangeSchema.safeParse(page.url.searchParams.get("range")).data,
  );
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap items-center justify-between gap-2 px-4">
    <nav class="flex gap-1" aria-label="Period">
      {#each [undefined, ...ClusterStatsHistoryRangeSchema.options] as option (option)}
        <a
          href={option ? `?range=${option}` : page.url.pathname}
          class={[
            "btn btn-sm",
            option === range ? "preset-filled-surface-100-900" : "hover:preset-tonal",
          ]}
          aria-current={option === range ? "page" : undefined}
        >
          {option ?? "Live"}
        </a>
      {/each}
    </nav>

    {#if range === undefined}
      <LiveQueryPing query={getClustersStatsLive({ interval: 1 })} />
    {/if}
  </div>

  <div
    class={[
      "grid grid-cols-1 gap-4 lg:grid-cols-2",
      "*:border *:border-surface-200-800 *:bg-surface-100-900",
    ]}
  >
    {#if range === undefined}
      <CPU />
      <Memory />
    {:else}
      {#key range}
        <svelte:boundary>
          <History {range} />

          {#snippet pending()}
            <div class="aspect-video placeholder animate-pulse"></div>
            <div class="aspect-video placeholder animate-pulse"></div>
          {/snippet}
        </svelte:boundary>
      {/key}
    {/if}
  </div>
</div>
