<script lang="ts">
  import AreaStackChart from "$lib/components/AreaStackChart.svelte";
  import Widget from "$lib/components/Widget.svelte";
  import { getClustersStatsHistory } from "$lib/remotes/clusters.remote";
  import formatBytes from "$lib/utils/formatBytes";
  import formatPercentage from "$lib/utils/formatPercentage";
  import type { ClusterStatsHistoryRange, ClusterStatsPoint } from "@hallmaster/backend/schemas";
  import { CpuIcon, MemoryStickIcon } from "@lucide/svelte";

  interface Props {
    range: ClusterStatsHistoryRange;
  }

  type Point = { date: Date; value: number };

  let { range }: Props = $props();

  let history = $derived(await getClustersStatsHistory(range));
  let clusters = $derived(Object.entries(history?.clusters ?? {}));
  let xDomain = $derived(history ? [new Date(history.from), new Date(history.to)] : undefined);

  let cpu = $derived(series(({ cpuPercentage }) => cpuPercentage / 100));
  let memory = $derived(series(({ memory }) => memory.usage));

  function series(measure: (point: ClusterStatsPoint) => number): Record<string, Point[]> {
    return Object.fromEntries(
      clusters.map(([id, points]) => [
        `Cluster ${id.padStart(2, "0")}`,
        points.map((point) => ({ date: new Date(point.at), value: measure(point) })),
      ]),
    );
  }

  function peak(data: Record<string, Point[]>) {
    const totals = new Map<number, number>();
    for (const { date, value } of Object.values(data).flat()) {
      totals.set(date.getTime(), (totals.get(date.getTime()) ?? 0) + value);
    }

    return Math.max(0, ...totals.values());
  }

  const header = {
    format: (date: Date) => date.toLocaleString([], { dateStyle: "short", timeStyle: "short" }),
  };
</script>

{#snippet empty()}
  <p class="m-auto text-sm text-surface-500">No stats stored over this period</p>
{/snippet}

<Widget icon={CpuIcon} title="CPU" value={`peak ${formatPercentage(peak(cpu))}`}>
  {#if clusters.length === 0}
    {@render empty()}
  {:else}
    <AreaStackChart
      data={cpu}
      {xDomain}
      x="date"
      y="value"
      axis={false}
      props={{ tooltip: { header, item: { format: formatPercentage } } }}
    />
  {/if}
</Widget>

<Widget icon={MemoryStickIcon} title="Memory" value={`peak ${formatBytes(peak(memory))}`}>
  {#if clusters.length === 0}
    {@render empty()}
  {:else}
    <AreaStackChart
      data={memory}
      {xDomain}
      x="date"
      y="value"
      axis={false}
      color="secondary"
      props={{ tooltip: { header, item: { format: formatBytes } } }}
    />
  {/if}
</Widget>
