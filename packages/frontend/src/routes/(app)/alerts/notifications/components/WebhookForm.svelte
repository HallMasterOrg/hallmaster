<script lang="ts">
  import { updateAlertWebhook } from "$lib/remotes/alerts.remote";
  import { getUsers } from "$lib/remotes/users.remote";
  import toaster from "$lib/utils/toaster";
  import toastError from "$lib/utils/toastError";
  import {
    AlertKindSchema,
    DISCORD_MESSAGE_MAX_LENGTH,
    UpdateAlertWebhookSchema,
    type AlertKind,
    type AlertWebhook,
  } from "@hallmaster/backend/schemas";
  import { Switch } from "@skeletonlabs/skeleton-svelte";
  import { untrack, type Snippet } from "svelte";

  import WebhookStatus from "./WebhookStatus.svelte";

  type Props = { webhook: AlertWebhook };

  let { webhook }: Props = $props();

  const form = updateAlertWebhook.preflight(UpdateAlertWebhookSchema);
  const { fields } = form;
  const users = getUsers();

  const kinds: Record<AlertKind, { label: string; description: string }> = {
    STOPPED: { label: "Down", description: "A cluster that should run has stopped" },
    CRASH_LOOP: { label: "Crash loop", description: "A cluster exited 3 times in 10 minutes" },
    OOM_KILLED: { label: "Out of memory", description: "A cluster used all its memory" },
  };

  fields.set(
    untrack(() => ({
      url: "",
      enabled: webhook.webhookId === null || webhook.enabled,
      content: webhook.content,
      kinds: webhook.kinds,
      notifyResolved: webhook.notifyResolved,
    })),
  );

  let content = $derived(fields.content.value() ?? "");
  let [urlIssue] = $derived(fields.url.issues() ?? []);
  let [contentIssue] = $derived(fields.content.issues() ?? []);
  let [kindsIssue] = $derived(fields.kinds.issues() ?? []);

  function mention(text: string) {
    fields.content.set(content.trim() === "" ? text : `${content.trimEnd()} ${text}`);
    void form.validate({ preflightOnly: true });
  }
</script>

{#snippet section(title: string, hint: string, body: Snippet)}
  <section
    class="grid gap-x-8 gap-y-3 border-t border-surface-200-800 py-5 md:grid-cols-[12rem_1fr]"
  >
    <div>
      <h3 class="text-sm font-bold">{title}</h3>
      <p class="text-xs text-surface-700-300">{hint}</p>
    </div>
    <div class="flex min-w-0 flex-col gap-2">
      {@render body()}
    </div>
  </section>
{/snippet}

{#snippet issue(message: string | undefined)}
  {#if message}
    <p class="text-xs text-error-500" role="alert">{message}</p>
  {/if}
{/snippet}

{#snippet webhookBody()}
  {#if webhook.webhookId !== null}
    <WebhookStatus webhook={{ ...webhook, webhookId: webhook.webhookId }} />
  {/if}

  <input
    {...fields.url.as("password")}
    class={["input text-sm", urlIssue && "border-error-500"]}
    aria-label="Webhook URL"
    placeholder={webhook.webhookId === null
      ? "https://discord.com/api/webhooks/…"
      : "Paste a new URL to replace it"}
    autocomplete="off"
    required={webhook.webhookId === null}
  />
  {@render issue(urlIssue?.message)}
{/snippet}

{#snippet mentionsBody()}
  <textarea
    {...fields.content.as("text")}
    class={["textarea font-mono text-sm", contentIssue && "border-error-500"]}
    aria-label="Message"
    rows="2"
    placeholder="@everyone, <@user ID>, <@&role ID>"
    spellcheck="false"></textarea>

  <div class="flex items-center gap-2">
    <ul class="flex grow flex-wrap gap-1" aria-label="Add a mention">
      {#each ["@everyone", "@here"] as text (text)}
        <li>
          <button type="button" class="chip preset-tonal text-xs" onclick={() => mention(text)}>
            {text}
          </button>
        </li>
      {/each}
      <svelte:boundary>
        {#each await users as user (user.id)}
          <li>
            <button
              type="button"
              class="chip preset-tonal text-xs"
              title={`<@${user.id}>`}
              onclick={() => mention(`<@${user.id}>`)}
            >
              @{user.displayName ?? user.username}
            </button>
          </li>
        {/each}

        {#snippet failed()}{/snippet}
      </svelte:boundary>
    </ul>
    <span class="shrink-0 text-xs text-surface-600-400">
      {content.length}/{DISCORD_MESSAGE_MAX_LENGTH}
    </span>
  </div>
  {@render issue(contentIssue?.message)}
{/snippet}

{#snippet alertsBody()}
  <div class="flex flex-wrap gap-2" role="group" aria-label="Alerts to post">
    {#each AlertKindSchema.options as kind (kind)}
      <label
        class="flex cursor-pointer items-center gap-2 card preset-outlined-surface-200-800 px-3 py-2 text-sm has-checked:preset-outlined-primary-500"
        title={kinds[kind].description}
      >
        <input class="checkbox" {...fields.kinds.as("checkbox", kind)} />
        {kinds[kind].label}
      </label>
    {/each}
  </div>
  {@render issue(kindsIssue?.message)}

  <Switch
    class="mt-1"
    checked={fields.notifyResolved.value()}
    onCheckedChange={({ checked }) => fields.notifyResolved.set(checked)}
  >
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.Label class="text-sm">Also post when they are resolved</Switch.Label>
    <Switch.HiddenInput />
  </Switch>
  <input {...fields.notifyResolved.as("hidden", fields.notifyResolved.value() ?? false)} />
{/snippet}

<form
  {...form.enhance(async ({ submit }) => {
    try {
      if (!(await submit())) return;

      fields.url.set("");
      toaster.success({ title: "Discord notifications saved" });
    } catch (error) {
      toaster.error(toastError(error));
    }
  })}
  class="flex flex-col"
  oninput={() => form.validate({ preflightOnly: true })}
>
  <header class="flex items-center justify-between gap-4 pb-5">
    <h2 class="h6 font-normal">Discord notifications</h2>

    <Switch
      checked={fields.enabled.value()}
      onCheckedChange={({ checked }) => fields.enabled.set(checked)}
    >
      <Switch.Label class="text-sm">Post the alerts</Switch.Label>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.HiddenInput />
    </Switch>
    <input {...fields.enabled.as("hidden", fields.enabled.value() ?? false)} />
  </header>

  {@render section("Webhook", "Channel settings › Integrations › Webhooks", webhookBody)}
  {@render section("Mentions", "Who gets pinged with each alert", mentionsBody)}
  {@render section("Alerts", "What gets posted", alertsBody)}

  <footer class="flex justify-end border-t border-surface-200-800 pt-4">
    <button class="btn preset-filled-primary-500 btn-sm" disabled={!!updateAlertWebhook.pending}>
      Save
    </button>
  </footer>
</form>
