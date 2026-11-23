<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import {
    getAlertWebhook,
    removeAlertWebhook,
    testAlertWebhook,
  } from "$lib/remotes/alerts.remote";
  import formatDuration from "$lib/utils/formatDuration";
  import toaster from "$lib/utils/toaster";
  import toastError from "$lib/utils/toastError";
  import type { AlertWebhook } from "@hallmaster/backend/schemas";
  import {
    CircleCheckIcon,
    SendIcon,
    Trash2Icon,
    TriangleAlertIcon,
    WebhookIcon,
  } from "@lucide/svelte";

  type Props = { webhook: AlertWebhook & { webhookId: string } };

  let { webhook }: Props = $props();

  let testing = $state(false);

  async function test() {
    testing = true;
    try {
      await testAlertWebhook();
      toaster.success({ title: "Test message posted", description: "Check the Discord channel" });
    } catch (error) {
      toaster.error(toastError(error));
      await getAlertWebhook().refresh();
    } finally {
      testing = false;
    }
  }

  function remove() {
    toaster.promise(removeAlertWebhook(), {
      loading: { title: "Removing the webhook.." },
      success: { title: "Alerts are no longer posted to Discord" },
      error: toastError,
    });
  }
</script>

<div class="flex items-center gap-3 card preset-outlined-surface-200-800 px-3 py-2">
  <WebhookIcon class="shrink-0 text-primary-600-400" size={20} />

  <div class="flex min-w-0 grow flex-col">
    <p class="truncate font-mono text-sm">{webhook.webhookId}</p>

    {#if webhook.lastError !== null}
      <p class="flex items-center gap-1 text-xs text-error-600-400" role="status">
        <TriangleAlertIcon class="shrink-0" size={12} />
        <span class="truncate" title={webhook.lastError}>{webhook.lastError}</span>
      </p>
    {:else if webhook.lastDeliveredAt !== null}
      <p class="flex items-center gap-1 text-xs text-surface-700-300" role="status">
        <CircleCheckIcon class="shrink-0 text-success-600-400" size={12} />
        Posted {formatDuration(Date.now() - Date.parse(webhook.lastDeliveredAt))} ago
      </p>
    {:else}
      <p class="text-xs text-surface-700-300" role="status">Nothing posted yet</p>
    {/if}
  </div>

  <button type="button" class="btn preset-tonal btn-sm" disabled={testing} onclick={test}>
    <SendIcon size={14} />
    Send a test
  </button>
  <ConfirmButton
    aria-label="Remove the webhook"
    title="Remove"
    icon={{ icon: Trash2Icon, size: 16 }}
    class="btn-icon-sm hover:text-error-500"
    onclick={remove}
  />
</div>
