<script lang="ts">
  import Widget from "$lib/components/Widget.svelte";
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { BoxIcon } from "@lucide/svelte";

  interface Props {
    shards: GetClusterDto["shardIds"];
  }

  let { shards }: Props = $props();

  let columns = $derived(Math.round(Math.sqrt((shards.length + 1) * (16 / 8))));
  let rows = $derived(Math.ceil((shards.length + 1) / columns));
</script>

<Widget icon={BoxIcon} title="Shards" value={shards.length}>
  <div
    class="grid grow gap-1.5"
    style:grid-template-columns="repeat({columns}, 1fr)"
    style:grid-template-rows="repeat({rows}, 1fr)"
  >
    {#each shards as id}
      <div
        class="@container flex items-center justify-center rounded-lg border border-surface-200-800 bg-surface-100-900"
      >
        <p
          class="truncate font-bold text-surface-700-300"
          style:font-size="clamp(0.625rem, 30cqw, 2em)"
        >
          {String(id).padStart(2, "0")}
        </p>
      </div>
    {/each}
  </div>
</Widget>
