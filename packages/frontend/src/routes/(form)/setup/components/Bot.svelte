<script lang="ts">
  import LabeledInput from "$lib/components/LabeledInput.svelte";
  import { createBot } from "$lib/remotes/bot.remote";
  import toaster from "$lib/utils/toaster";
  import {
    BracesIcon,
    ChevronRightIcon,
    ContainerIcon,
    LoaderCircleIcon,
    RectangleEllipsisIcon,
    TextCursorIcon,
  } from "@lucide/svelte";
  import { Switch } from "@skeletonlabs/skeleton-svelte";
  import { slide } from "svelte/transition";

  const { url, username, password, token } = createBot.fields;

  let authentication: boolean = $state(false);
</script>

<form
  {...createBot.enhance(async ({ submit, element }) => {
    await submit()
      .then(() => element.reset())
      .catch((error) =>
        toaster.create({
          type: "error",
          title: "Error",
          description: JSON.parse(error).message,
        }),
      );
  })}
>
  <LabeledInput
    label="Container image url"
    icon={ContainerIcon}
    placeholder="ghcr.io/image:tag"
    required
    {...url.as("text")}
    issues={url.issues()}
  />

  <Switch
    checked={authentication}
    onCheckedChange={(details) => (authentication = details.checked)}
  >
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.Label>Registry authentication</Switch.Label>
    <Switch.HiddenInput />
  </Switch>

  {#if authentication}
    <div class="grid grid-cols-2 gap-2" transition:slide={{ duration: 150 }}>
      <LabeledInput
        label="Username"
        icon={TextCursorIcon}
        required
        {...username.as("text")}
        issues={username.issues()}
      />

      <LabeledInput
        label="Password"
        icon={RectangleEllipsisIcon}
        required
        {...password.as("password")}
        issues={password.issues()}
      />
    </div>
  {/if}

  <LabeledInput
    label="Bot token"
    icon={BracesIcon}
    placeholder="8f0a2f30b4e738362ee19e8e572edb8a"
    required
    {...token.as("password")}
    issues={token.issues()}
  />

  <button class="btn preset-filled-primary-500 text-sm" disabled={!!createBot.pending}>
    Register bot
    {#if createBot.pending}
      <LoaderCircleIcon class="animate-spin" />
    {:else}
      <ChevronRightIcon />
    {/if}
  </button>
</form>
