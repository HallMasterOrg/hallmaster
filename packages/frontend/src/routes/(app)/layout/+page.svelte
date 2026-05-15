<script lang="ts">
  import { updateBotLayout } from "$lib/remotes/bot.remote";
  import { getClusters } from "$lib/remotes/clusters.remote";
  import { LayoutManager } from "$lib/utils/LayoutManager.svelte";
  import toaster from "$lib/utils/toaster";
  import {
    BoxesIcon,
    LoaderCircleIcon,
    PlusIcon,
    SaveIcon,
    XIcon,
  } from "@lucide/svelte";

  let data = $derived(
    (await getClusters()).map(({ id, shardIds }) => ({
      id,
      shardIds,
    })),
  );

  let layout = $derived(new LayoutManager(data));
</script>

<div class="flex justify-end items-center">
  <button
    class="btn-icon bg-surface-50-950 text-primary-700-300"
    onclick={() => {
      updateBotLayout({ layout: layout.export() }).catch((error) => {
        toaster.create({
          type: "error",
          title: "Error",
          description: JSON.parse(error).message,
        });
      });
    }}
  >
    {#if updateBotLayout.pending}
      <LoaderCircleIcon class="animate-spin" strokeWidth={1.5} />
    {:else}
      <SaveIcon strokeWidth={1.5} />
    {/if}
  </button>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
  {#each layout.clusters as cluster, index}
    {@const columns = Math.round(
      Math.sqrt((cluster.shards.length + 1) * (16 / 8)),
    )}
    {@const rows = Math.ceil((cluster.shards.length + 1) / columns)}
    <div
      class={{
        "aspect-video flex flex-col p-2 rounded-lg gap-2 border bg-surface-100-900": true,
        "border-surface-200-800": cluster.mutation === "unchanged",
        "border-error-600-400": cluster.mutation === "deleted",
        "border-success-600-400": cluster.mutation === "added",
      }}
    >
      <div class="flex justify-between">
        <div class="flex gap-1 items-center pl-2">
          <BoxesIcon size={18} class="text-primary-800-200" />
          <h3 class="font-bold text-surface-800-200">
            Cluster {String(index).padStart(2, "0")}
            <span class="text-surface-500 text-sm"
              >({cluster.shards.length})</span
            >
          </h3>
        </div>

        <button
          class="btn-icon btn-icon-sm hover:text-error-800-200 hover:bg-surface-100-900 transition-colors"
          onclick={() => layout.remove(index)}
        >
          <XIcon />
        </button>
      </div>

      <div
        class={[
          "grow grid gap-1.5",
          "*:@container *:rounded-lg *:flex *:justify-center *:items-center",
        ]}
        style:grid-template-columns={`repeat(${columns}, 1fr)`}
        style:grid-template-rows={`repeat(${rows}, 1fr)`}
      >
        {#each cluster.shards as shard}
          <button
            class={{
              "btn border border-surface-300-700 bg-surface-200-800 hover:text-error-700-300": true,
              "text-surface-700-300": shard.mutation === "unchanged",
              "text-error-700-300": shard.mutation === "deleted",
              "text-success-700-300": shard.mutation === "added",
              "text-primary-700-300": shard.mutation === "moved",
            }}
            onclick={() => cluster.remove(shard.id)}
          >
            <p
              class="truncate font-bold"
              style:font-size="clamp(0px, 40cqw, 2em)"
            >
              {String(shard.id).padStart(2, "0")}
            </p>
          </button>
        {/each}

        <button
          class="btn text-surface-700-300 hover:text-primary-700-300 hover:bg-surface-100-900"
          style:font-size="clamp(0px, 40cqw, 2em)"
          onclick={() => cluster.add()}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  {/each}

  <button
    class="btn btn-lg aspect-video flex rounded-lg bg-surface-50-950 text-surface-700-300 hover:text-primary-700-300"
    onclick={() => layout.add()}
  >
    <PlusIcon />
  </button>
</div>
