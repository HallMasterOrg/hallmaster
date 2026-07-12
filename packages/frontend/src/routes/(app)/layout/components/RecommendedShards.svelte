<script lang="ts">
  import { getRecommendedShards } from "$lib/remotes/bot.remote";
  import { InfoIcon, RotateCcwIcon } from "@lucide/svelte";
  import { Portal, Tooltip } from "@skeletonlabs/skeleton-svelte";
</script>

<Tooltip>
  <Tooltip.Trigger>
    <span class="badge text-primary-600-400">
      <InfoIcon size={14} />
      <span class="inline-flex items-center gap-1">
        Recommended amount:
        <svelte:boundary>
          <span class="font-bold">{await getRecommendedShards()}</span>

          {#snippet pending()}
            <div class="size-[1em] placeholder animate-pulse rounded-sm"></div>
          {/snippet}

          {#snippet failed(_, reset)}
            <button class="chip-icon preset-tonal p-1" onclick={() => reset()}>
              <RotateCcwIcon size={12} />
            </button>
          {/snippet}
        </svelte:boundary>
      </span>
    </span>
  </Tooltip.Trigger>
  <Portal>
    <Tooltip.Positioner>
      <Tooltip.Content
        class="card border border-surface-200-800 preset-filled-surface-100-900 px-2 py-1 shadow"
      >
        <blockquote class="blockquote text-surface-800-200">
          Recommended number of shards based on bot size
        </blockquote>
      </Tooltip.Content>
    </Tooltip.Positioner>
  </Portal>
</Tooltip>
