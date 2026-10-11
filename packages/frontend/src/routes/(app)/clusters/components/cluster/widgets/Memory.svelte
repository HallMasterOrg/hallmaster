<script lang="ts">
  import LiveAreaChart from "$lib/components/LiveAreaChart.svelte";
  import Widget from "$lib/components/Widget.svelte";
  import { getClusterStatsLive } from "$lib/remotes/clusters.remote";
  import formatBytes from "$lib/utils/formatBytes";
  import type { Cluster, ClusterStats } from "@hallmaster/backend/schemas";
  import { MemoryStickIcon } from "@lucide/svelte";
  import { onMount } from "svelte";

  interface Props {
    id: Cluster["id"];
  }

  let { id }: Props = $props();

  let value = $state<{
    date: Date;
    value: ClusterStats["memory"]["usage"];
  }>();

  onMount(() => {
    let unmounted = false;
    (async () => {
      for await (const { date, memory } of getClusterStatsLive(id)) {
        if (unmounted) break;
        value = {
          date,
          value: memory.usage,
        };
      }
    })();

    return () => (unmounted = true);
  });
</script>

<Widget icon={MemoryStickIcon} title="Memory" value={formatBytes(value?.value ?? 0)}>
  <LiveAreaChart
    {value}
    x="date"
    y="value"
    axis={false}
    color="var(--color-secondary-500)"
    props={{
      tooltip: {
        item: { format: formatBytes, label: "Memory Usage" },
      },
    }}
  />
</Widget>
