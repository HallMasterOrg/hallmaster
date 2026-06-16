<script lang="ts">
  import ClusterLogs from "$lib/components/ClusterLogs.svelte";
  import type { GetClusterDto } from "@hallmaster/backend/dto";
  import { LogsIcon } from "@lucide/svelte";
  import Widget from "../Widget.svelte";

  interface Props {
    id: GetClusterDto["id"];
  }

  let { id }: Props = $props();
</script>

<Widget icon={LogsIcon} title="Logs">
  {#snippet bare()}
    <ClusterLogs {id} style="scrollbar-width: thin;" class="text-tiny" />
  {/snippet}
</Widget>
