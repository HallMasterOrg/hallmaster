<script lang="ts">
  import BoundaryFailed from "$lib/components/BoundaryFailed.svelte";
  import { getAlertWebhook } from "$lib/remotes/alerts.remote";

  import WebhookForm from "./components/WebhookForm.svelte";

  const webhook = getAlertWebhook();
</script>

<svelte:boundary>
  {@const current = await webhook}

  {#key current.webhookId}
    <WebhookForm webhook={current} />
  {/key}

  {#snippet pending()}
    <div class="flex flex-col gap-3">
      <div class="h-8 placeholder animate-pulse"></div>
      <div class="h-64 placeholder animate-pulse"></div>
    </div>
  {/snippet}

  {#snippet failed(error, reset)}
    <BoundaryFailed {error} {reset} />
  {/snippet}
</svelte:boundary>
