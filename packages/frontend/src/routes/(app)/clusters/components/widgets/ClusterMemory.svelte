<script lang="ts">
  import LiveAreaChart from "$lib/components/LiveAreaChart.svelte";
  import { getClusterStatsLive } from "$lib/remotes/clusters.remote";
  import formatBytes from "$lib/utils/formatBytes";
  import type {
    GetClusterDto,
    GetClusterStatsDto,
  } from "@hallmaster/backend/dto";
  import { MemoryStickIcon } from "@lucide/svelte";
  import { curveCatmullRom } from "d3-shape";
  import Widget from "../Widget.svelte";

  interface Props {
    id: GetClusterDto["id"];
  }

  let { id }: Props = $props();

  let value = $state<{
    date: Date;
    memory: GetClusterStatsDto["memory"]["usage"];
  }>();

  $effect(() => {
    getClusterStatsLive({ id, interval: 2 }).then(({ date, memory }) => {
      value = {
        memory: memory.usage,
        date,
      };
    });
  });
</script>

<Widget
  icon={MemoryStickIcon}
  title="Memory"
  value={formatBytes(value?.memory ?? 0)}
>
  <LiveAreaChart
    {value}
    x="date"
    y="memory"
    axis={false}
    props={{
      tooltip: {
        item: { format: formatBytes },
        header: { format: (x) => new Date(x).toLocaleTimeString() },
      },
      area: { curve: curveCatmullRom },
    }}
  />
</Widget>
