<script lang="ts">
  import { getClusters, getClustersLive } from "$lib/remotes/clusters.remote";
  import { ChevronRightIcon } from "@lucide/svelte";
  import { Collapsible } from "@skeletonlabs/skeleton-svelte";
  import { slide } from "svelte/transition";
  import ClusterActions from "./components/ClusterActions.svelte";
  import ClusterLogs from "./components/ClusterLogs.svelte";
  import ClusterShards from "./components/ClusterShards.svelte";
  import ClusterStatus from "./components/ClusterStatus.svelte";
  import ClusterMemory from "./components/ClusterMemory.svelte";
  import ClusterCPU from "./components/ClusterCPU.svelte";

  let clusters = getClusters();
  $effect(() => {
    getClustersLive().then((data) => clusters.set(data));
  });
</script>

<div class="flex flex-col gap-4">
  {#each await clusters as { id, status, shardIds } (id)}
    <Collapsible class="card preset-filled-surface-100-900">
      <div
        class="flex items-center gap-2 p-2 preset-filled-surface-100-900 w-full rounded-xl justify-between border border-surface-200-800 shadow-lg sticky top-0"
      >
        <Collapsible.Trigger class="btn grow justify-start">
          <Collapsible.Indicator class="group">
            <ChevronRightIcon
              class="group-data-[state=open]:rotate-90 transition-transform"
            />
          </Collapsible.Indicator>
          <ClusterStatus {status} />
          <p class="text-lg text-surface-700-300 font-bold">
            {String(id).padStart(2, "0")}
          </p>
        </Collapsible.Trigger>

        <div class="flex gap-1">
          <ClusterActions {id} {status} />
        </div>
      </div>

      <Collapsible.Content>
        {#snippet element(attributes)}
          {#if !attributes.hidden}
            <div
              {...attributes}
              class="grid sm:grid-cols-2 grid-cols-1 gap-2 p-2 w-full *:aspect-video"
              transition:slide
            >
              <ClusterShards shards={shardIds} />
              <ClusterLogs {id} />
              <ClusterCPU {id} />
              <ClusterMemory {id} />
            </div>
          {/if}
        {/snippet}
      </Collapsible.Content>
    </Collapsible>
  {/each}
</div>
