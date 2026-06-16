<script lang="ts">
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { BoxIcon } from "@lucide/svelte";
  import Widget from "../Widget.svelte";

  interface Props {
    shards: GetClusterDto["shardIds"];
  }

  let { shards }: Props = $props();

  let columns = $derived(Math.round(Math.sqrt((shards.length + 1) * (16 / 8))));
  let rows = $derived(Math.ceil((shards.length + 1) / columns));
</script>

<Widget
  icon={BoxIcon}
  title="Shards"
  value={shards.length}
  class="grow grid gap-1.5"
  style={`grid-template-columns: repeat(${columns}, 1fr); grid-template-rows: repeat(${rows}, 1fr);`}
>
  {#each shards as id}
    <div
      class="@container rounded-lg flex justify-center items-center border border-surface-200-800 bg-surface-100-900"
    >
      <p
        class="truncate text-surface-700-300 font-bold"
        style:font-size="clamp(0px, 40cqw, 2em)"
      >
        {String(id).padStart(2, "0")}
      </p>
    </div>
  {/each}
</Widget>
