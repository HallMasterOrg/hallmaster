<script lang="ts">
  import LiveQueryPing from "$lib/components/LiveQueryPing.svelte";
  import { getClustersStatsLive } from "$lib/remotes/clusters.remote";

  import CPU from "./components/CPU.svelte";
  import Memory from "./components/Memory.svelte";
</script>

<div class="flex flex-col gap-4">
  <div class="flex justify-end px-4">
    <LiveQueryPing query={getClustersStatsLive()} />
  </div>

  <div
    class={[
      "grid grid-cols-1 gap-4 lg:grid-cols-2",
      "*:border *:border-surface-200-800 *:bg-surface-100-900",
    ]}
  >
    <CPU />
    <Memory />
  </div>
</div>
