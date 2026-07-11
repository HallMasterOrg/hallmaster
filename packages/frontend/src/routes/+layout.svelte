<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import toaster from "$lib/utils/toaster";
  import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon } from "@lucide/svelte";
  import { Toast } from "@skeletonlabs/skeleton-svelte";

  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<Toast.Group {toaster}>
  {#snippet children(toast)}
    <Toast {toast}>
      {#if toast.type === "loading"}
        <LoaderCircleIcon class="animate-spin" />
      {:else if toast.type === "success"}
        <CircleCheckIcon />
      {:else if toast.type === "error"}
        <CircleXIcon />
      {/if}

      <Toast.Message>
        <Toast.Title>{toast.title}</Toast.Title>
        <Toast.Description>{toast.description}</Toast.Description>
      </Toast.Message>
      <Toast.CloseTrigger />
    </Toast>
  {/snippet}
</Toast.Group>
