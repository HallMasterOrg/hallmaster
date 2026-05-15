<script lang="ts">
  import {
    getClusters,
    restartCluster,
    startCluster,
    stopCluster,
  } from "$lib/remotes/clusters.remote";
  import toaster from "$lib/utils/toaster";
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import {
    LoaderCircleIcon,
    PlayIcon,
    RotateCcwIcon,
    SquareIcon,
    TrashIcon,
  } from "@lucide/svelte";

  type Props = {
    id?: GetClusterDto["id"];
    status: GetClusterDto["status"];
  };

  let { id, status }: Props = $props();

  const actions = [
    {
      label: "start",
      remote: startCluster,
      icon: PlayIcon,
      require: "STOPPED",
    },
    {
      label: "restart",
      remote: restartCluster,
      icon: RotateCcwIcon,
      require: "RUNNING",
    },
    {
      label: "stop",
      remote: stopCluster,
      icon: SquareIcon,
      require: "RUNNING",
    },
  ] as const;

  let loading: (typeof actions)[number]["label"] | null = $state(null);
</script>

{#if id}
  {#each actions as { require, remote, icon, label }}
    {#if require === status}
      {@const Icon = icon}

      <button
        class="btn-icon"
        onclick={() => {
          loading = label;
          remote(id)
            .catch((error) => {
              toaster.create({
                type: "error",
                title: "Error",
                description: JSON.parse(error).message,
              });
              getClusters().refresh();
            })
            .finally(() => (loading = null));
        }}
        disabled={loading === label}
      >
        {#if loading === label}
          <LoaderCircleIcon class="animate-spin" />
        {:else}
          <Icon />
        {/if}
      </button>
    {/if}
  {/each}
{/if}
