<script lang="ts">
  import { RefreshCcw } from "@lucide/svelte";
  import type { RemoteLiveQuery } from "@sveltejs/kit";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLButtonElement> {
    query: RemoteLiveQuery<unknown>;
    variant?: "default" | "short";
  }

  let { query, variant = "default", ...props }: Props = $props();
</script>

{#if query.connected || query.loading}
  <div class="flex items-center gap-2 py-0.5">
    <span class="relative flex size-3 *:rounded-full">
      <span
        class="absolute h-full w-full preset-filled-primary-400-600"
        class:animate-ping={!query.loading}
      ></span>
      <span class="relative grow preset-filled-primary-500"></span>
    </span>

    {#if variant === "default"}
      <p class="text-xs text-primary-600-400">Live</p>
    {/if}
  </div>
{:else}
  <button
    onclick={() => query.reconnect()}
    {...props}
    class={[
      "preset-filled-surface-100-900",
      `${variant === "default" ? "chip px-2 py-0.5" : "chip-icon"}`,
      props.class,
    ]}
  >
    <RefreshCcw size={12} />

    {#if variant === "default"}
      <p class="text-xs">Refresh</p>
    {/if}
  </button>
{/if}
