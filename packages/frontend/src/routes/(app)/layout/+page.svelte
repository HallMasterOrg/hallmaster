<script lang="ts">
  import BoundaryFailed from "$lib/components/BoundaryFailed.svelte";
  import { getClusters } from "$lib/remotes/clusters.remote";
  import { LayoutManager } from "$lib/utils/LayoutManager.svelte";
  import { PlusIcon } from "@lucide/svelte";

  import Actions from "./components/Actions.svelte";
  import Cluster from "./components/Cluster.svelte";
  import RecommendedShards from "./components/RecommendedShards.svelte";
</script>

{#snippet actionRow(layout?: LayoutManager)}
  <div class="flex items-center justify-between">
    <RecommendedShards />
    <Actions {layout} />
  </div>
{/snippet}

<svelte:boundary>
  {let data = $state(await getClusters())}
  {let layout = $derived(new LayoutManager(data))}

  {@render actionRow(layout)}

  <div class="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
    {#each layout.clusters as cluster, index}
      <Cluster {index} {layout} {cluster} />
    {/each}

    <button
      class="btn flex aspect-video rounded-lg bg-surface-50-950 btn-lg text-surface-700-300 hover:text-primary-700-300"
      onclick={() => layout.add()}
    >
      <PlusIcon />
    </button>
  </div>

  {#snippet pending()}
    {@render actionRow()}

    <div class="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
      {#each { length: 6 }}
        <div class="flex aspect-video placeholder animate-pulse"></div>
      {/each}
    </div>
  {/snippet}

  {#snippet failed(error, reset)}
    <BoundaryFailed {error} {reset} />
  {/snippet}
</svelte:boundary>
