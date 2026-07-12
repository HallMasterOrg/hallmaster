<script lang="ts">
  import { LayoutManager } from "$lib/utils/LayoutManager.svelte";

  type Shards = NonNullable<LayoutManager["clusters"][number]["shards"]>;
  interface Props {
    id: Parameters<Shards["get"]>[0];
    state: NonNullable<ReturnType<Shards["get"]>>;
  }

  let { id, state }: Props = $props();
</script>

<div
  class="border border-surface-300-700 bg-surface-200-800"
  class:text-surface-700-300={state === "unchanged"}
  class:text-error-700-300={state === "deleted"}
  class:text-success-700-300={state === "added"}
  class:text-primary-700-300={state === "moved"}
>
  <p
    class="truncate font-bold"
    class:line-through={state === "deleted"}
    style:font-size="clamp(0.625rem, 30cqw, 2em)"
  >
    {String(id).padStart(2, "0")}
  </p>
</div>
