<script lang="ts">
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { Collapsible } from "@skeletonlabs/skeleton-svelte";
  import { slide } from "svelte/transition";

  import ClusterCPU from "./cluster/widgets/CPU.svelte";
  import ClusterLogs from "./cluster/widgets/Logs.svelte";
  import ClusterMemory from "./cluster/widgets/Memory.svelte";
  import ClusterShards from "./cluster/widgets/Shards.svelte";

  interface Props {
    cluster: GetClusterDto;
    open: boolean;
  }

  let { cluster, open }: Props = $props();
</script>

<Collapsible.Content>
  {#snippet element(attributes)}
    <!-- Forced to use a custom open variable as attributes.hidden is not reliable with svelte boundaries -->
    {#if open}
      <div
        {...attributes}
        class={[
          "grid w-full grid-cols-1 gap-2 p-2 lg:grid-cols-2",
          "p-2 *:border *:border-surface-200-800 *:bg-surface-50-950",
        ]}
        transition:slide
      >
        <ClusterShards shards={cluster.shardIds} />
        <ClusterLogs id={cluster.id} />
        {#if cluster.status !== "STOPPED"}
          <ClusterCPU id={cluster.id} />
          <ClusterMemory id={cluster.id} />
        {/if}
      </div>
    {/if}
  {/snippet}
</Collapsible.Content>
