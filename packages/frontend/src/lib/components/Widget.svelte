<script lang="ts">
  import type { Icon } from "@lucide/svelte";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    icon: typeof Icon;
    title: string;
    value?: string | number;
    action?: Snippet;
    children: Snippet;
  }

  let { icon, title, value, action, children, ...props }: Props = $props();
</script>

<div
  {...props}
  class={["flex aspect-video flex-col gap-2 overflow-y-hidden rounded-lg p-2", props.class]}
>
  <div class="flex items-center justify-between px-2">
    <div class="flex items-center gap-1">
      {const Icon = icon}
      <Icon size={18} class="text-primary-800-200" />

      <h3 class="font-bold text-surface-800-200">
        {title}

        {#if value !== undefined}
          <span class="text-sm text-surface-500">
            ({value})
          </span>
        {/if}
      </h3>
    </div>

    {@render action?.()}
  </div>

  {@render children()}
</div>
