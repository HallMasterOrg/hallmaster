<script lang="ts">
  import { getClusterLogs, getClusterLogsLive } from "$lib/remotes/clusters.remote";
  import type { Cluster, ClusterLogs } from "@hallmaster/backend/schemas";
  import { Progress } from "@skeletonlabs/skeleton-svelte";
  import { onMount } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { fade } from "svelte/transition";

  import BoundaryFailed from "./BoundaryFailed.svelte";
  import ReversedVirtualList from "./ReversedVirtualList.svelte";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
    id: Cluster["id"];
  }

  let { id, ...props }: Props = $props();

  let live = $state<ClusterLogs>([]);
  onMount(() => {
    let unmounted = false;
    (async () => {
      for await (const logs of getClusterLogsLive(id)) {
        if (unmounted) break;
        live.push(...logs);
      }
    })();

    return () => (unmounted = true);
  });
</script>

<svelte:boundary>
  {const items = await getClusterLogs({ id })}

  <ReversedVirtualList
    items={items.concat(live)}
    {...props}
    class={["text-nowrap whitespace-pre", props.class]}
  >
    {#snippet children({ content, stream })}
      <p
        class={{
          "text-error-500": stream === "STDERR",
        }}
      >
        {content}
      </p>
    {/snippet}
  </ReversedVirtualList>

  {#snippet pending()}
    <div class="flex h-full w-full place-items-center px-12" in:fade={{ delay: 1000 }}>
      <Progress value={null}>
        <Progress.Track class={["h-[1em]", props.class]}>
          <Progress.Range class="bg-surface-400-600" />
        </Progress.Track>
      </Progress>
    </div>
  {/snippet}

  {#snippet failed(error, reset)}
    <BoundaryFailed {error} {reset} />
  {/snippet}
</svelte:boundary>
