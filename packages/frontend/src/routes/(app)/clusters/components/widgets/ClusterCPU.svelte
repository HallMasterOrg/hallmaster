<script lang="ts">
  import LiveAreaChart from "$lib/components/LiveAreaChart.svelte";
  import { getClusterStatsLive } from "$lib/remotes/clusters.remote";
  import type {
    GetClusterDto,
    GetClusterStatsDto,
  } from "@hallmaster/backend/dto";
  import { CpuIcon } from "@lucide/svelte";
  import { curveCatmullRom } from "d3-shape";
  import Widget from "../Widget.svelte";

  interface Props {
    id: GetClusterDto["id"];
  }

  let { id }: Props = $props();

  let value = $state<{
    date: Date;
    cpuPercentage: GetClusterStatsDto["cpuPercentage"];
  }>();

  $effect(() => {
    getClusterStatsLive({ id, interval: 2 }).then(
      ({ date, cpuPercentage }) => (value = { date, cpuPercentage }),
    );
  });
</script>

<Widget
  icon={CpuIcon}
  title="CPU"
  value={`${value?.cpuPercentage.toPrecision(2) ?? 0} %`}
>
  <LiveAreaChart
    {value}
    x="date"
    y="cpuPercentage"
    axis={false}
    props={{
      tooltip: {
        item: {
          format: (y: number) => y.toPrecision(2) + "%",
        },
        header: { format: (x) => new Date(x).toLocaleTimeString() },
      },
      area: { curve: curveCatmullRom },
    }}
  />
</Widget>
