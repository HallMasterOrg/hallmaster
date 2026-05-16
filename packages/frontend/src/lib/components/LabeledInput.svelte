<script lang="ts">
  import { type Icon, TriangleAlertIcon } from "@lucide/svelte";
  import type { RemoteFormIssue } from "@sveltejs/kit";
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props extends HTMLInputAttributes {
    label: string;
    icon?: typeof Icon;
    issues?: RemoteFormIssue[];
    suffix?: Snippet;
  }

  let { label, icon, issues, suffix, ...props }: Props = $props();
</script>

<label class="label">
  <div class={["ml-1 flex gap-1", issues && "text-error-500"]}>
    {#if issues}
      <TriangleAlertIcon size={16} />
    {:else if icon}
      {@const Icon = icon}
      <Icon size={16} />
    {/if}

    <span class="label-text">
      {label}
      {#if props.required}
        <span class="text-primary-500">*</span>
      {/if}
    </span>
  </div>

  <div class="input flex items-center gap-1">
    <input class="grow" {...props} />
    {@render suffix?.()}
  </div>
</label>
