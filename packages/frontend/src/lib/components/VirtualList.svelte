<!--
  Home made virtual list until a library features:
    - reverse list
    - live data updates (with snapping at the start)
    - overflow x
    - text selection
-->
<script lang="ts" generics="T">
  import { tick, type Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import type { HTMLAttributes, UIEventHandler } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    items: T[];
    reverse?: boolean;
    children: Snippet<[T]>;
  }

  let { items, reverse = false, children, ...props }: Props = $props();

  // const heightMap: number[] = $derived(Array.from({ length: items.length }));
  const heightMap: number[] = [];

  let start = $state(0);
  let end = $state(0);

  let width = 0;
  let average = $state(0);

  let paddingTop = $state(0);
  let paddingBottom = $derived(average * (items.length - end));

  const init: Attachment<HTMLElement> = ({ offsetHeight }) => {
    (async () => {
      const { length } = items;
      let i = 0,
        y = 0;
      for (; i < length && y < offsetHeight; y += heightMap[i], i++) {
        end = i + 1;
        await tick();
      }
      average = y / i;
    })();
  };

  const onscroll: UIEventHandler<HTMLElement> = ({ currentTarget }) => {
    const offsetHeight = currentTarget.offsetHeight;
    const scrollTop = Math.abs(currentTarget.scrollTop);
    const { length } = items;

    let i = 0;
    let y = 0;

    for (; i < length; y += heightMap[i] ?? average, i++) {
      if (y + (heightMap[i] ?? average) < scrollTop) continue;

      start = i;
      paddingTop = y;
      break;
    }

    for (
      ;
      i < length && y < scrollTop + offsetHeight;
      y += heightMap[i] ?? average, i++
    );
    end = i;
    average = y / i;
  };
</script>

<div
  {@attach !average && init}
  {onscroll}
  {...props}
  class={["overflow-auto flex w-full h-full", props.class]}
  style:flex-direction={reverse ? "column-reverse" : "column"}
>
  <div
    style:padding-bottom={`${reverse ? paddingTop : paddingBottom}px`}
    style:padding-top={`${reverse ? paddingBottom : paddingTop}px`}
  >
    {#each items.slice(start, end).reverse() as item, index (start + index)}
      <div
        class="min-w-fit w-fit"
        {@attach ({ offsetHeight, offsetWidth, style }) => {
          if (offsetWidth > width) width = offsetWidth;
          else style.width = `${width}px`;

          heightMap[start + index] = offsetHeight;
        }}
      >
        {@render children(item)}
      </div>
    {/each}
  </div>
</div>
