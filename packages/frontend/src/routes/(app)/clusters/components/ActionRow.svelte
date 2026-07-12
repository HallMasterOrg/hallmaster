<script lang="ts">
  import {
    getClusters,
    restartClusters,
    startClusters,
    stopClusters,
  } from "$lib/remotes/clusters.remote";
  import toaster from "$lib/utils/toaster";
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { PlayIcon, RotateCcwIcon, SquareIcon, XIcon } from "@lucide/svelte";
  import { fade } from "svelte/transition";

  interface Props {
    group: GetClusterDto["id"][];
  }

  let { group = $bindable() }: Props = $props();

  let actions = $derived([
    {
      label: "start",
      icon: PlayIcon,
      remote: startClusters,
      loading: (id: string) => ({
        title: `Starting cluster ${id}`,
      }),
      success: (id: string) => ({
        title: `Cluster ${id} successfully started`,
      }),
    },
    {
      label: "restart",
      icon: RotateCcwIcon,
      remote: restartClusters,
      loading: (cluster: string) => ({
        title: `Restarting cluster ${cluster}`,
      }),
      success: (cluster: string) => ({
        title: `Cluster ${cluster} successfully restarted`,
      }),
    },
    {
      label: "stop",
      icon: SquareIcon,
      remote: stopClusters,
      loading: (cluster: string) => ({
        title: `Stopping cluster ${cluster}`,
      }),
      success: (cluster: string) => ({
        title: `Cluster ${cluster} successfully stopped`,
      }),
    },
  ]);
</script>

<div class="flex items-center justify-between">
  <div class="flex">
    {#if group.length}
      <button
        class="btn preset-filled-primary-500 btn-sm"
        onclick={() => (group = [])}
        in:fade={{ duration: 100 }}
      >
        <XIcon size={14} />
        <span>{group.length} selected</span>
      </button>
    {/if}
  </div>

  <div class="flex justify-self-end px-4">
    {#each actions as { label, icon, loading, success, remote }}
      {const Icon = icon}
      {let isLoading = false}

      <button
        class="btn preset-tonal-surface btn-sm"
        disabled={isLoading || !group.length}
        onclick={async () => {
          await Promise.all(
            group.map((id) => {
              const cluster = String(id).padStart(2, "0");
              return toaster
                .promise(remote(id).refresh(), {
                  loading: loading(cluster),
                  success: success(cluster),
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
                })
                ?.unwrap();
            }),
          );

          await getClusters().refresh();
        }}
      >
        <Icon size={14} />
        <span class="capitalize">{label}</span>
      </button>
    {/each}
  </div>
</div>
