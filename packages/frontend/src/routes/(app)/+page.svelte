<script lang="ts">
import { onMount } from "svelte";
import { getClusters } from "$lib/remotes/clusters.remote";
import Header from "./components/Header.svelte";

onMount(() => {
  setInterval(async () => {
    await getClusters().refresh();
  }, 1000);
});
</script>

<main
  class="absolute top-1/2 left-1/2 -translate-1/2 w-full max-w-6xl min-w-xl"
>
  <div
    class="card preset-filled-surface-50-950 p-6 mx-6 flex flex-wrap gap-4 *:flex-[1_1_0]"
  >
    {#each await getClusters() as { id, shardIds, status }}
      <div class="flex flex-col gap-2 card preset-filled-surface-100-900 p-4">
        <Header {id} {status} />
        <div class="flex flex-wrap gap-1 *:flex-[1_1_0]">
          {#each shardIds as id}
            <div
              class="flex card preset-filled-surface-50-950 p-2 justify-center"
            >
              #{id}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</main>
