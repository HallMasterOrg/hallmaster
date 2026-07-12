<script lang="ts">
  import LiveAreaStackChart from "$lib/components/LiveAreaStackChart.svelte";
  import Widget from "$lib/components/Widget.svelte";
  import { getClustersStatsLive } from "$lib/remotes/clusters.remote";
  import formatBytes from "$lib/utils/formatBytes";
  import type { GetAggregateStatsDto } from "@hallmaster/backend/dto";
  import { MemoryStickIcon } from "@lucide/svelte";
  import { onMount, type ComponentProps } from "svelte";

  let value = $state<ComponentProps<LiveAreaStackChart["value"]>>();

  onMount(() => {
    let unmounted = false;
    (async () => {
      for await (const { date, ...stats } of getClustersStatsLive({ interval: 1 })) {
        if (unmounted) break;
        value = Object.fromEntries(
          Object.entries(stats as GetAggregateStatsDto).map(([key, { memory }]) => [
            `Cluster ${key.padStart(2, "0")}`,
            { date, value: memory.usage },
          ]),
        );
      }
    })();

    return () => (unmounted = true);
  });

  let sum = $derived.by<GetAggregateStatsDto[number]["memory"]["usage"]>(() => {
    if (!value) return 0;

    return Object.values(value).reduce((acc, { value }) => acc + value, 0);
  });
</script>

<Widget icon={MemoryStickIcon} title="Memory" value={formatBytes(sum)}>
  <LiveAreaStackChart
    {value}
    x="date"
    y="value"
    axis={false}
    color="secondary"
    props={{ tooltip: { item: { format: formatBytes } } }}
  />
</Widget>
