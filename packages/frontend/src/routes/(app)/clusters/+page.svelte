<script lang="ts">
  import { getClusters, getClustersLive } from "$lib/remotes/clusters.remote";
  import { ChevronRightIcon, EyeOffIcon, SquareArrowOutUpRight } from "@lucide/svelte";
  import { Collapsible } from "@skeletonlabs/skeleton-svelte";
  import { slide } from "svelte/transition";
  import ClusterActions from "./components/ClusterActions.svelte";
  import ClusterLogs from "./components/widgets/ClusterLogs.svelte";
  import ClusterShards from "./components/widgets/ClusterShards.svelte";
  import ClusterStatus from "./components/ClusterStatus.svelte";
  import ClusterMemory from "./components/widgets/ClusterMemory.svelte";
  import ClusterCPU from "./components/widgets/ClusterCPU.svelte";

  let clusters = getClusters();
  $effect(() => {
    getClustersLive().then((data) => clusters.set(data));
  });
</script>

<div class="flex flex-col gap-4">
  {#each await clusters as { id, status, shardIds } (id)}
    {let open = $state<boolean>();}

    <Collapsible
      class="card preset-filled-surface-100-900"
      onOpenChange={(details) => (open = details.open)}
    >
      <div
        class="flex items-center gap-2 p-2 preset-filled-surface-100-900 w-full rounded-xl justify-between border border-surface-200-800 shadow-lg sticky top-0 z-10"
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
          {#if open} <!-- Forced to use a custom open variable as attributes.hidden is not reliable with svelte boundaries -->
            <div
              {...attributes}
              class="grid sm:grid-cols-2 grid-cols-1 gap-2 p-2 w-full *:aspect-video"
              transition:slide
            >
              <ClusterShards shards={shardIds} />
              <ClusterLogs {id} />
              {#if status !== "STOPPED"}
                <ClusterCPU {id} />
                <ClusterMemory {id} />
              {/if}
            </div>
            {/if}
          {/snippet}
        </Collapsible.Content>
    </Collapsible>
    {:else}
      <div class="self-center flex flex-col items-center">
        <EyeOffIcon size={48} class="text-primary-600-400" />
        <p class="text-lg font-bold">No clusters</p>
        <a href="/layout" class="btn btn-sm preset-filled-primary-500">
          <span>Setup</span>
          <SquareArrowOutUpRight size={16} />
        </a>
      </div>
  {/each}
</div>
