<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { updateBotLayout } from "$lib/remotes/bot.remote";
  import { getClusters } from "$lib/remotes/clusters.remote";
  import toaster from "$lib/utils/toaster";
  import { RotateCwIcon } from "@lucide/svelte";

  const clusters = getClusters();

  let deployed = $derived((await clusters).length > 0);

  async function redeploy() {
    const layout = (await clusters).map(({ id, shardIds }) => ({ id, shardIds }));

    toaster.promise(updateBotLayout(layout), {
      loading: { title: "Redeploying clusters.." },
      success: { title: "Clusters redeployed" },
      error: (error) => ({
        title: "Error",
        description: JSON.parse(error as string)?.message ?? "An error occurred",
      }),
    });
  }
</script>

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
