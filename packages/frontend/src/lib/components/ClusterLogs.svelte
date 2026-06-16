<script lang="ts">
  import VirtualList from "$lib/components/VirtualList.svelte";
  import { getClusterLogs, getClusterLogsLive } from "$lib/remotes/clusters.remote";
  import type { GetClusterDto, GetClusterLogsDto } from "@hallmaster/backend/dto";
  import { RotateCcwIcon } from "@lucide/svelte";
  import { Progress } from "@skeletonlabs/skeleton-svelte";
  import { type HttpError } from "@sveltejs/kit";
  import type { HTMLAttributes } from "svelte/elements";
  import { fade } from "svelte/transition";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
    id: GetClusterDto["id"];
  }

  let { id, ...props }: Props = $props();

  let live = $state<GetClusterLogsDto>([]);
  $effect(() => {
    getClusterLogsLive(id).then((log) => live.unshift(log));
  });
</script>

<svelte:boundary>
  {const items = await getClusterLogs({ id })}

  <VirtualList
    reverse
    items={live.concat(items)}
    {...props}
    class={["whitespace-pre text-nowrap", props.class]}
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
  </VirtualList>

  {#snippet pending()}
    <div
      class="w-full h-full px-12 flex place-items-center"
      in:fade={{ delay: 1000 }}
    >
      <Progress value={null}>
        <Progress.Track class={["h-[1em]", props.class]}>
          <Progress.Range class="bg-surface-400-600" />
        </Progress.Track>
      </Progress>
    </div>
  {/snippet}

  {#snippet failed(error, reset)}
    <div class="m-auto">
      <h1 class="h1 text-surface-500">{(error as HttpError).status ?? 500}</h1>
      <h5 class="h5">{(error as HttpError).body.message ?? "An error occurred"}</h5>
      <button type="button" class="btn btn-sm preset-filled-primary-500" onclick={reset}>
        <RotateCcwIcon size={16} />
        <span>Retry</span>
      </button>
    </div>
  {/snippet}
</svelte:boundary>
