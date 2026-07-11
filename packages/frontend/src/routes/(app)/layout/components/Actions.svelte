<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { updateBotLayout } from "$lib/remotes/bot.remote";
  import type { LayoutManager } from "$lib/utils/LayoutManager.svelte";
  import toaster from "$lib/utils/toaster";
  import { SaveIcon } from "@lucide/svelte";

  interface Props {
    layout?: LayoutManager;
  }

  let { layout }: Props = $props();

  let changed = $derived(layout?.clusters.some(({ state }) => state !== "unchanged") ?? false);
</script>

<div class="flex items-center gap-1">
  <ConfirmButton
    icon={{ icon: SaveIcon, strokeWidth: 1.5, size: 16 }}
    label="Save changes"
    class="preset-filled-primary-500 btn-sm"
    // @ts-expect-error
    disabled={!changed || !!updateBotLayout.pending}
    onclick={() => {
      toaster.promise(updateBotLayout({ layout: layout!.export() }), {
        loading: { title: "Updating layout.." },
        success: { title: "Successfully applied layout" },
        error: (error) => ({
          title: "Error",
          description: JSON.parse(error as string)?.message ?? "An error occurred",
        }),
      });
    }}
  />

  <button
    class="btn btn-sm not-disabled:hover:underline"
    onclick={() => layout?.reset()}
    disabled={!changed}
  >
    <span>Reset</span>
  </button>
</div>
