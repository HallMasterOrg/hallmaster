<script lang="ts">
  import LiveAreaChart from "$lib/components/LiveAreaChart.svelte";
  import Widget from "$lib/components/Widget.svelte";
  import { getClusterStatsLive } from "$lib/remotes/clusters.remote";
  import formatPercentage from "$lib/utils/formatPercentage";
  import type { GetClusterDto, GetClusterStatsDto } from "@hallmaster/backend/dto";
  import { CpuIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  interface Props {
    id: GetClusterDto["id"];
  }

  let { id }: Props = $props();

  let value = $state<{
    date: Date;
    value: GetClusterStatsDto["cpuPercentage"];
  }>();

  onMount(() => {
    let unmounted = false;
    (async () => {
      for await (const { date, cpuPercentage } of getClusterStatsLive(id)) {
        if (unmounted) break;
        value = { date, value: cpuPercentage / 100 };
      }
    })();

    return () => (unmounted = true);
  });
</script>

<Widget
  icon={CpuIcon}
  title="CPU"
  value={formatPercentage(value?.value ?? 0)}
  class="border border-surface-200-800 bg-surface-50-950 p-2"
>
  <LiveAreaChart
    {value}
    x="date"
    y="value"
    axis={false}
    props={{
      tooltip: {
        item: {
          format: formatPercentage,
          label: "CPU Usage",
        },
      },
    }}
  />
</Widget>
