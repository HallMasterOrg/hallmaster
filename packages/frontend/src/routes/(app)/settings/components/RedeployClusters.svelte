<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { redeployClusters } from "$lib/remotes/bot.remote";
  import { getClusters, getOutdatedClusters } from "$lib/remotes/clusters.remote";
  import toaster from "$lib/utils/toaster";
  import toastError from "$lib/utils/toastError";
  import { RotateCwIcon, TriangleAlertIcon } from "@lucide/svelte";
  import { fade } from "svelte/transition";

  const clusters = getClusters();
  const outdated = getOutdatedClusters();

  let deployed = $derived((await clusters).length > 0);
  let behind = $derived((await outdated).length);
  let updating = $derived(
    (await clusters).some(({ status }) => ["STARTING", "UPDATING", "WAITING"].includes(status)),
  );

  $effect(() => {
    if (!updating) return;

    const interval = setInterval(async () => {
      await clusters.refresh();
      await outdated.refresh();
    }, 2_000);

    return () => clearInterval(interval);
  });

  function redeploy() {
    toaster.promise(redeployClusters(), {
      loading: { title: "Starting the redeploy.." },
      success: {
        title: "Redeploying the clusters",
        description:
          "One by one, each once the previous one is ready. A failure brings every cluster back",
      },
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
    title={!deployed
      ? "No cluster is deployed yet"
      : updating
        ? "The clusters are being deployed"
        : "Replace the clusters one by one with the saved image, token and environment"}
    disabled={!deployed || updating || !!redeployClusters.pending}
    onclick={redeploy}
  />
</div>
