<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { updateBotLayout } from "$lib/remotes/bot.remote";
  import { getClusters, getOutdatedClusters } from "$lib/remotes/clusters.remote";
  import toaster from "$lib/utils/toaster";
  import toastError from "$lib/utils/toastError";
  import { RotateCwIcon, TriangleAlertIcon } from "@lucide/svelte";
  import { fade } from "svelte/transition";

  const clusters = getClusters();
  const outdated = getOutdatedClusters();

  let deployed = $derived((await clusters).length > 0);
  let behind = $derived((await outdated).length);

  async function redeploy() {
    const layout = (await clusters).map(({ id, shardIds }) => ({ id, shardIds }));

    toaster.promise(updateBotLayout(layout), {
      loading: { title: "Redeploying clusters.." },
      success: { title: "Clusters redeployed" },
      error: toastError,
    });
  }
</script>

<div class="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
  {#if behind > 0}
    <p
      class="flex items-center gap-1.5 text-xs whitespace-nowrap text-warning-600-400"
      transition:fade
    >
      <TriangleAlertIcon size={14} />
      Changes not deployed to {behind} cluster{behind === 1 ? "" : "s"}
    </p>
  {/if}

  <ConfirmButton
    label="Redeploy clusters"
    icon={{ icon: RotateCwIcon, size: 16 }}
    class="preset-tonal btn-sm"
    title={deployed
      ? "Recreate the clusters with the saved image, token and environment"
      : "No cluster is deployed yet"}
    disabled={!deployed || !!updateBotLayout.pending}
    onclick={redeploy}
  />
</div>
