<script lang="ts">
  import BoundaryFailed from "$lib/components/BoundaryFailed.svelte";
  import { getClusters, getClustersLive } from "$lib/remotes/clusters.remote";
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { EyeOffIcon, SquareArrowOutUpRight } from "@lucide/svelte";
  import { Collapsible } from "@skeletonlabs/skeleton-svelte";
  import { onMount } from "svelte";

  import ActionRow from "./components/ActionRow.svelte";
  import ClusterActions from "./components/cluster/QuickActions.svelte";
  import CollapsibleContent from "./components/CollapsibleContent.svelte";
  import CollapsibleTrigger from "./components/CollapsibleTrigger.svelte";

  let query = getClusters();
  onMount(() => {
    let unmounted = false;
    (async () => {
      for await (const live of getClustersLive()) {
        if (unmounted) break;
        query.set(live);
      }
    })();

    return () => (unmounted = true);
  });

  let group = $state<GetClusterDto["id"][]>([]);
</script>

<div class="flex flex-col gap-4">
  <ActionRow bind:group />

  <div class="flex flex-col gap-4">
    <svelte:boundary>
      {#each await query as cluster (cluster.id)}
        {let open = $state(false)}

        <Collapsible
          class="card preset-filled-surface-100-900"
          onOpenChange={(details) => (open = details.open)}
        >
          <div
            class="sticky top-0 z-10 flex w-full items-center justify-between rounded-xl border border-surface-200-800 preset-filled-surface-100-900 px-4 py-2 shadow-lg"
          >
            <input
              type="checkbox"
              class="checkbox"
              value={cluster.id}
              aria-label={`select-cluster-${cluster.id}`}
              bind:group
            />
            <CollapsibleTrigger {cluster} />
            <ClusterActions id={cluster.id} status={cluster.status} />
          </div>

          <CollapsibleContent {cluster} {open} />
        </Collapsible>
      {:else}
        <div class="flex flex-col items-center self-center">
          <EyeOffIcon size={48} class="text-primary-600-400" />
          <p class="text-lg font-bold">No clusters</p>
          <a href="/layout" class="btn preset-filled-primary-500 btn-sm">
            <span>Setup</span>
            <SquareArrowOutUpRight size={16} />
          </a>
        </div>
      {/each}

      {#snippet pending()}
        {#each { length: 6 }}
          <div class="h-14 placeholder animate-pulse"></div>
        {/each}
      {/snippet}

      {#snippet failed(error, reset)}
        <BoundaryFailed {error} {reset} />
      {/snippet}
    </svelte:boundary>
  </div>
</div>
