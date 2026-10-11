<script lang="ts">
  import ClusterLogs from "$lib/components/ClusterLogs.svelte";
  import LiveQueryPing from "$lib/components/LiveQueryPing.svelte";
  import Widget from "$lib/components/Widget.svelte";
  import { getClusterLogs, getClusterLogsLive } from "$lib/remotes/clusters.remote";
  import type { Cluster } from "@hallmaster/backend/schemas";
  import { LogsIcon } from "@lucide/svelte";

  interface Props {
    id: Cluster["id"];
  }

  let { id }: Props = $props();
</script>

<Widget icon={LogsIcon} title="Logs" class="overflow-y-hidden">
  {#snippet action()}
    <LiveQueryPing
      query={getClusterLogsLive(id)}
      variant="short"
      onclick={async () => {
        await getClusterLogs({ id }).refresh();
        getClusterLogsLive(id).reconnect();
      }}
    />
  {/snippet}
  <ClusterLogs {id} style="scrollbar-width: thin;" class="text-2xs" />
</Widget>
