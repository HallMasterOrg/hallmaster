<script lang="ts">
  import {
    getClusters,
    restartCluster,
    startCluster,
    stopCluster,
  } from "$lib/remotes/clusters.remote";
  import toaster from "$lib/utils/toaster";
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { PlayIcon, RotateCcwIcon, SquareIcon } from "@lucide/svelte";

  type Props = {
    id: GetClusterDto["id"];
    status: GetClusterDto["status"];
  };

  let { id, status }: Props = $props();

  let actions = $derived.by(() => {
    const paddedId = String(id).padStart(2, "0");

    return [
      {
        label: "start",
        remote: startCluster,
        icon: PlayIcon,
        require: "STOPPED",
        loading: {
          title: `Starting cluster ${paddedId}`,
        },
        success: {
          title: `Cluster ${paddedId} successfully started`,
        },
      },
      {
        label: "restart",
        remote: restartCluster,
        icon: RotateCcwIcon,
        require: "RUNNING",
        loading: {
          title: `Restarting cluster ${paddedId}`,
        },
        success: {
          title: `Cluster ${paddedId} successfully restarted`,
        },
      },
      {
        label: "stop",
        remote: stopCluster,
        icon: SquareIcon,
        require: "RUNNING",
        loading: {
          title: `Stopping cluster ${paddedId}`,
        },
        success: {
          title: `Cluster ${paddedId} successfully stopped`,
        },
      },
    ] as const;
  });
</script>

<div class="flex gap-1">
  {#each actions as { require, remote, icon, label, loading, success }}
    {#if require === status}
      {let isLoading = $state(false)}
      {const Icon = icon}

      <button
        class="btn-icon"
        title={label}
        onclick={() => {
          isLoading = true;
          toaster.promise(remote(id), {
            loading,
            success,
            error(error) {
              getClusters().refresh();
              return {
                title: "Error",
                description: JSON.parse(error as string)?.message ?? "An error occurred",
              };
            },
            finally() {
              isLoading = false;
            },
          });
        }}
        disabled={isLoading}
      >
        <Icon />
      </button>
    {/if}
  {/each}
</div>
