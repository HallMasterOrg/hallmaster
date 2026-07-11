<script lang="ts">
  import LiveAreaStackChart from "$lib/components/LiveAreaStackChart.svelte";
  import Widget from "$lib/components/Widget.svelte";
  import { getClustersStatsLive } from "$lib/remotes/clusters.remote";
  import formatPercentage from "$lib/utils/formatPercentage";
  import type { GetAggregateStatsDto } from "@hallmaster/backend/dto";
  import { CpuIcon } from "@lucide/svelte";
  import { onMount, type ComponentProps } from "svelte";

  let value = $state<ComponentProps<LiveAreaStackChart["value"]>>();

  onMount(() => {
    let unmounted = false;
    (async () => {
      for await (const { date, ...stats } of getClustersStatsLive()) {
        console.log(unmounted);
        if (unmounted) break;
        value = Object.fromEntries(
          Object.entries(stats as GetAggregateStatsDto).map(([key, { cpuPercentage }]) => [
            `Cluster ${key.padStart(2, "0")}`,
            { date, value: cpuPercentage / 100 },
          ]),
        );
      }
    })();

    return () => (unmounted = true);
  });

  let sum = $derived.by<GetAggregateStatsDto[number]["cpuPercentage"]>(() => {
    if (!value) return 0;

    return Object.values(value).reduce((acc, { value }) => acc + value, 0);
  });
</script>

<Widget icon={CpuIcon} title="CPU" value={formatPercentage(sum)}>
  <LiveAreaStackChart
    {value}
    x="date"
    y="value"
    axis={false}
    props={{ tooltip: { item: { format: formatPercentage } } }}
  />
</Widget>
