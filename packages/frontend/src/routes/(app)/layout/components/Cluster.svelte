<script lang="ts">
  import Widget from "$lib/components/Widget.svelte";
  import { LayoutManager } from "$lib/utils/LayoutManager.svelte";
  import { BoxesIcon, CopyIcon, MinusIcon, PlusIcon } from "@lucide/svelte";

  import Shard from "./Shard.svelte";

  interface Props {
    index: number;
    layout: LayoutManager;
    cluster: LayoutManager["clusters"][number];
  }

  let { index, layout, cluster }: Props = $props();
</script>

{const columns = $derived(Math.round(Math.sqrt((cluster.shards!.size + 1) * (16 / 8))))}
{const rows = $derived(Math.ceil((cluster.shards!.size + 1) / columns))}

<Widget
  icon={BoxesIcon}
  title={`Cluster ${String(index).padStart(2, "0")}`}
  value={cluster
    .shards!.values()
    .filter((state) => state !== "deleted")
    .toArray().length}
  class={{
    "flex aspect-video flex-col gap-2 rounded-lg border bg-surface-100-900 p-2": true,
    "border-surface-200-800": cluster.state === "unchanged" || cluster.state === "changed",
    "border-error-600-400": cluster.state === "deleted",
    "border-success-600-400": cluster.state === "added",
  }}
>
  {#snippet action()}
    {#if cluster.state !== "deleted"}
      <div class="flex gap-1">
        <button
          class="btn-icon btn-icon-sm transition-colors hover:bg-surface-100-900 hover:text-error-800-200"
          onclick={() => layout.remove(index)}
        >
          <MinusIcon />
        </button>
        <button
          class="btn-icon btn-icon-sm transition-colors hover:bg-surface-100-900"
          onclick={() => layout.add(cluster.current.size)}
        >
          <CopyIcon />
        </button>
      </div>
    {/if}
  {/snippet}

  <div
    class={[
      "grid grow gap-1.5 overflow-y-auto",
      "*:@container *:flex *:items-center *:justify-center *:rounded-lg",
    ]}
    style:grid-template-columns="repeat({columns}, 1fr)"
    style:grid-template-rows="repeat({rows}, 1fr)"
  >
    {#each cluster.shards as [id, state]}
      <Shard {id} {state} />
    {/each}

    {#if cluster.state !== "deleted"}
      <div class={["flex", "*:h-full *:w-full *:p-0"]}>
        <button
          class="btn-icon rounded-r-none text-surface-700-300 hover:bg-surface-100-900 hover:text-error-700-300"
          style:font-size="clamp(0.625rem, 30cqw, 2em)"
          onclick={() => cluster.pop()}
        >
          <MinusIcon />
        </button>
        <button
          class="btn-icon rounded-l-none text-surface-700-300 hover:bg-surface-100-900 hover:text-primary-700-300"
          style:font-size="clamp(0.625rem, 30cqw, 2em)"
          onclick={() => cluster.add()}
        >
          <PlusIcon />
        </button>
      </div>
    {/if}
  </div>
</Widget>
