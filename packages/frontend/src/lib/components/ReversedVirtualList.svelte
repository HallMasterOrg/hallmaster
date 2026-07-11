<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { Virtualizer, type VirtualizerHandle } from "virtua/svelte";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    items: T[];
    children: Snippet<[T]>;
  }

  let { items, children, ...props }: Props = $props();

  let virtualizer = $state<VirtualizerHandle>();
  let stickToEnd = $state(true);

  const onscroll = (offset: number) => {
    if (!virtualizer) return;

    stickToEnd = offset - virtualizer.getScrollSize() + virtualizer.getViewportSize() >= -1.5;
  };

  $effect(() => {
    if (!virtualizer || !stickToEnd) return;

    virtualizer.scrollToIndex(items.length - 1, { align: "end" });
  });
</script>

<div {...props} class={["flex flex-col overflow-y-auto", props.class]}>
  <Virtualizer bind:this={virtualizer} data={items} {onscroll}>
    {#snippet children(item, index)}
      {@render children(item, index)}
    {/snippet}
  </Virtualizer>
</div>
