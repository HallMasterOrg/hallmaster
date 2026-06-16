<script lang="ts">
  import type { Icon } from "@lucide/svelte";
  import type { Snippet } from "svelte";
    import type { HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children">{
    icon: typeof Icon;
    title: string;
    value?: string | number;
    children?: Snippet;
    bare?: Snippet; // TODO Find a way to get rid of this
  }

  let {icon, title, value, children, bare, ...props}: Props = $props();
</script>

<div
  class="flex flex-col p-2 rounded-lg bg-surface-50-950 gap-2 border border-surface-200-800 overflow-y-hidden"
>
  <div class="flex gap-1 items-center pl-2">
    {const Icon = icon}
    <Icon size={18} class="text-primary-800-200" />
    <h3 class="font-bold text-surface-800-200">
      {title}

      {#if value !== undefined}
        <span class="text-surface-500 text-sm">
          ({value})
        </span>
      {/if}
    </h3>
  </div>

  {#if bare}
    {@render bare()}
  {:else if children}
    <div {...props} class={["grow p-1", props.class]}>
      {@render children()}
    </div>
  {/if}
</div>
