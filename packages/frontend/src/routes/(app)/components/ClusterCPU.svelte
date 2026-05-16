<script lang="ts">
  import { getClusterStatsLive } from "$lib/remotes/clusters.remote";
  import type {
    GetClusterDto,
    GetClusterStatsDto,
  } from "@hallmaster/backend/dto";
  import { CpuIcon } from "@lucide/svelte";
  import { AreaChart } from "layerchart";

  interface Props {
    id: GetClusterDto["id"];
  }

  let { id }: Props = $props();

  let cpu: {
    percentage: GetClusterStatsDto["cpuPercentage"];
    date: Date;
  }[] = $state([]);

  $effect(() => {
    getClusterStatsLive(id).then((stats) => {
      cpu.push({
        percentage: stats.cpuPercentage,
        date: new Date(),
      });
      while (cpu.length && cpu[0].date.getTime() <= Date.now() - 60000) cpu.shift();
    });
  });
</script>

<div
  class="flex flex-col p-2 rounded-lg bg-surface-50-950 gap-2 border border-surface-200-800"
>
  <div class="flex gap-1 items-center pl-2">
    <CpuIcon size={18} class="text-primary-800-200" />
    <h3 class="font-bold text-surface-800-200">
      CPU
      <span class="text-surface-500 text-sm">
        ({cpu.at(-1)?.percentage.toPrecision(2) ?? 0} %)
      </span>
    </h3>
  </div>

  <div class="grow p-1">
    <AreaChart
      data={cpu}
      x="date"
      y="percentage"
      xDomain={[new Date(Date.now() - 60000), cpu.at(-1)?.date]}
      axis={false}
      props={{
        tooltip: {
          item: {
            format: (y: number) => y.toPrecision(2) + "%",
          },
          header: { format: (x) => new Date(x).toLocaleTimeString() },
        },
      }}
    />
  </div>
</div>
