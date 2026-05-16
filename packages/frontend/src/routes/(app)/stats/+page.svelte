<script lang="ts">
  import { getClustersStatsLive } from "$lib/remotes/clusters.remote";
  import formatBytes from "$lib/utils/formatBytes";
  import { CpuIcon, Icon, MemoryStickIcon } from "@lucide/svelte";
  import { Progress } from "@skeletonlabs/skeleton-svelte";
  const sum = (acc: number, value: number) => acc + value;

  let live = getClustersStatsLive();

  let cpu = $derived(
    Object.values(await live)
      .map((value) => value.cpuPercentage)
      .reduce(sum, 0),
  );

  let memory = $derived(
    Object.values(await live)
      .map((value) => value.memory.percentage)
      .reduce(sum, 0),
  );

  let memoryUsage = $derived(
    Object.values(await live)
      .map((value) => value.memory.usage)
      .reduce(sum, 0),
  );
</script>

{#snippet card(
  label: string,
  icon: typeof Icon,
  percentage: number,
  value: string[],
)}
  {@const Icon = icon}
  <div
    class="@container relative flex card aspect-video preset-filled-surface-100-900 border border-surface-200-800"
  >
    <div class="z-10 flex items-center justify-center w-full">
      <Icon class="flex-3 size-36 text-surface-50-950 opacity-50" />

      <div class="flex-4 flex flex-col gap-2 justify-center">
        <p class="font-bold text-xl text-surface-500">{label}</p>
        {#each value as value}
          <p class="text-5xl font-bold opacity-75">{value}</p>
        {/each}
      </div>
    </div>

    <Progress value={percentage} class="absolute h-full top-0 left-0">
      <Progress.Track class="h-full bg-transparent">
        <Progress.Range
          class="bg-primary-600-400 shadow-[4px_0px_6px_0px_rgba(0,0,0,0.1)]  rounded-l-xl rounded-r-none transition-[width]"
        />
      </Progress.Track>
    </Progress>
  </div>
{/snippet}

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {@render card("CPU", CpuIcon, cpu, [cpu.toPrecision(2) + "%"])}
  {@render card("Memory", MemoryStickIcon, memory, [
    memory.toPrecision(2) + "%",
    formatBytes(memoryUsage),
  ])}
</div>
