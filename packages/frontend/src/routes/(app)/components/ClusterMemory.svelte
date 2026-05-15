<script lang="ts">
  import { getClusterStatsLive } from "$lib/remotes/clusters.remote";
  import formatBytes from "$lib/utils/formatBytes";
  import type {
    GetClusterDto,
    GetClusterStatsDto,
  } from "@hallmaster/backend/dto";
  import { MemoryStickIcon } from "@lucide/svelte";
  import { AreaChart } from "layerchart";

  interface Props {
    id: GetClusterDto["id"];
  }

  let { id }: Props = $props();

  let memory: {
    usage: GetClusterStatsDto["memory"]["usage"];
    date: Date;
  }[] = $state([]);

  $effect(() => {
    getClusterStatsLive(id).then((stats) => {
      memory.push({
        usage: stats.memory.usage,
        date: new Date(),
      });
      if (memory[0].date.getTime() < Date.now() - 60000) memory.shift();
    });
  });
</script>

<div
  class="flex flex-col p-2 rounded-lg bg-surface-50-950 gap-2 border border-surface-200-800"
>
  <div class="flex gap-1 items-center pl-2">
    <MemoryStickIcon size={18} class="text-primary-800-200" />
    <h3 class="font-bold text-surface-800-200">
      Memory
      <span class="text-surface-500 text-sm">
        ({formatBytes(memory.at(-1)?.usage ?? 0)})
      </span>
    </h3>
  </div>

  <div class="grow p-1">
    <AreaChart
      data={memory}
      x="date"
      y="usage"
      xDomain={[new Date(Date.now() - 60000), memory.at(-1)?.date]}
      axis={false}
      props={{
        tooltip: {
          item: { format: formatBytes },
          header: { format: (x) => new Date(x).toLocaleTimeString() },
        },
      }}
    />
  </div>
</div>
