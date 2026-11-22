<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import LabeledInput from "$lib/components/LabeledInput.svelte";
  import { generateWebhookToken, getWebhook } from "$lib/remotes/bot.remote";
  import toaster from "$lib/utils/toaster";
  import toastError from "$lib/utils/toastError";
  import { CopyIcon, RefreshCwIcon, WebhookIcon } from "@lucide/svelte";

  const webhook = getWebhook();

  let { enabled } = $derived(await webhook);
  let token = $state<string>();

  function generate() {
    toaster.promise(generateWebhookToken(), {
      loading: { title: "Generating webhook token.." },
      success: (generated) => {
        token = generated;
        return { title: "Generated a new webhook token", description: "Copy it now" };
      },
      error: toastError,
    });
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(
      () => toaster.create({ type: "success", title: "Copied webhook token" }),
      () => toaster.create({ type: "error", title: "Could not copy, select the token instead" }),
    );
  }
</script>

<div class="flex flex-col gap-1">
  <LabeledInput
    label="Deploy webhook token"
    icon={WebhookIcon}
    placeholder={enabled
      ? "A token is set, regenerate it to see a new one"
      : "Generate a token to let your CI deploy the bot"}
    readonly
    value={token ?? ""}
  >
    {#snippet suffix()}
      {#if token}
        <button
          type="button"
          class="btn-icon btn-icon-sm text-primary-700-300"
          aria-label="Copy webhook token"
          onclick={() => copy(token!)}
        >
          <CopyIcon />
        </button>
      {/if}

      {#if enabled}
        <ConfirmButton
          icon={{ icon: RefreshCwIcon }}
          aria-label="Regenerate webhook token"
          class="btn-icon-sm text-primary-700-300"
          disabled={!!generateWebhookToken.pending}
          onclick={generate}
        />
      {:else}
        <button
          type="button"
          class="btn preset-filled-primary-500 btn-sm"
          disabled={!!generateWebhookToken.pending}
          onclick={generate}
        >
          Generate
        </button>
      {/if}
    {/snippet}
  </LabeledInput>

  <p class="ml-1 text-xs text-surface-700-300">
    {#if token}
      Copy it now, HallMaster only keeps its hash and cannot show it again.
    {/if}
    Once your CI has pushed a new tag of the image above, it sends
    <code class="code">{`{"tag": "<tag>"}`}</code>
    to <code class="code">POST /api/webhooks/deploy</code> with this token as a bearer token.
    HallMaster then redeploys every cluster with that tag, one by one. Regenerating the token
    disables the previous one right away.
    <a
      class="anchor"
      href="https://github.com/hallmasterorg/hallmaster#deploy-from-your-ci"
      target="_blank"
      rel="noreferrer"
    >
      How to call it from your CI
    </a>
  </p>
</div>
