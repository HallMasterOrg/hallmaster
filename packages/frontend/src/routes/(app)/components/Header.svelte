<script lang="ts">
import type { GetClusterDto } from "@hallmaster/backend/dto";
import {
  CircleCheckIcon,
  LoaderCircleIcon,
  OctagonAlertIcon,
  PlayIcon,
  RotateCwIcon,
  SquareIcon,
} from "@lucide/svelte";
import {
  restartCluster,
  startCluster,
  stopCluster,
} from "$lib/remotes/clusters.remote";
import toaster from "$lib/utils/toaster";

interface Props {
  id: GetClusterDto["id"];
  status: GetClusterDto["status"];
}

let { id, status }: Props = $props();
</script>

<div class="flex justify-between gap-12">
  <div class="flex gap-2 items-center">
    {#if status === "RUNNING"}
      <span class="badge size-fit preset-filled-success-400-600">
        <CircleCheckIcon size={16} />
        {status.toLowerCase()}
      </span>
    {:else if status === "STARTING"}
      <span class="badge size-fit preset-filled-warning-500">
        <LoaderCircleIcon class="animate-spin" size={16} />
        {status.toLowerCase()}
      </span>
    {:else if status === "STOPPED"}
      <span class="badge size-fit preset-filled-surface-500">
        <SquareIcon size={16} />
        {status.toLowerCase()}
      </span>
    {:else if status === "ERROR"}
      <span class="badge size-fit preset-filled-error-500">
        <OctagonAlertIcon size={16} />
        {status.toLowerCase()}
      </span>
    {/if}
  </div>

  <div class="flex *:transition-none">
    {#if status === "RUNNING" || status === "STARTING"}
      <button
        title="Stop"
        class="chip-icon hover:preset-filled-error-300-700"
        onclick={() => {
          stopCluster(id).catch((error) => {
            toaster.create({
              type: "error",
              title: "Error",
              description: JSON.parse(error).message,
            });
          });
        }}
      >
        <SquareIcon size={16} />
      </button>
      <button
        title="Restart"
        class="chip-icon hover:preset-filled-surface-500"
        onclick={() => {
          restartCluster(id).catch((error) => {
            toaster.create({
              type: "error",
              title: "Error",
              description: JSON.parse(error).message,
            });
          });
        }}
      >
        <RotateCwIcon size={16} />
      </button>
    {:else if status === "STOPPED" || status === "ERROR"}
      <button
        title="Start"
        class="chip-icon hover:preset-filled-primary-500"
        onclick={() => {
          startCluster(id).catch((error) => {
            toaster.create({
              type: "error",
              title: "Error",
              description: JSON.parse(error).message,
            });
          });
        }}
      >
        <PlayIcon size={16} />
      </button>
    {/if}
  </div>
</div>
