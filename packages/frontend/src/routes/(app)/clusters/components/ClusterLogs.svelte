<script lang="ts">
  import {
    getClusterLogs,
    getClusterLogsLive,
  } from "$lib/remotes/clusters.remote";
  import type {
    GetClusterDto,
    GetClusterLogsDto,
  } from "@hallmaster/backend/dto";
  import { LogsIcon } from "@lucide/svelte";
  import { fade } from "svelte/transition";

  interface Props {
    id: GetClusterDto["id"];
  }

  let { id }: Props = $props();

  let live: GetClusterLogsDto = $state([]);
  $effect(() => {
    getClusterLogsLive(id).then((log) => live.push(log));
  });
</script>

<div
  class="flex flex-col p-2 overflow-y-hidden rounded-lg bg-surface-50-950 gap-2 border border-surface-200-800"
>
  <div class="flex gap-1 items-center pl-2">
    <LogsIcon size={18} class="text-primary-800-200" />
    <h3 class="font-bold text-surface-800-200">Logs</h3>
  </div>

  {#await getClusterLogs(id) then logs}
    <div
      class="flex flex-col-reverse text-tiny whitespace-pre overflow-auto bg-transparent p-0"
      style:scrollbar-width="thin"
      transition:fade={{ duration: 150 }}
    >
      {#each logs.concat(live).toReversed() as { content, stream }}
        <p
          class={{
            "text-nowrap": true,
            "text-error-500": stream === "STDERR",
          }}
        >
          {content}
        </p>
      {/each}
    </div>
  {/await}
</div>
