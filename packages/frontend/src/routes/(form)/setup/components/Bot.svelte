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

  const { dockerImage, token } = createBot.fields;

  let authentication: boolean = $state(false);
</script>

<form
  {...createBot.enhance(async ({ submit, form }) => {
    await submit()
      .then(() => form.reset())
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
    {...dockerImage.image.as("text")}
    issues={dockerImage.image.issues()}
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
    <div class="flex gap-2" transition:slide={{ duration: 150 }}>
      <LabeledInput
        label="Username"
        icon={TextCursorIcon}
        required
        {...dockerImage.username.as("text")}
        issues={dockerImage.username.issues()}
      />

      <LabeledInput
        label="Password"
        icon={RectangleEllipsisIcon}
        required
        {...dockerImage.password.as("password")}
        issues={dockerImage.password.issues()}
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

  <button
    class="btn text-sm preset-filled-primary-500"
    disabled={!!createBot.pending}
  >
    Register bot
    {#if createBot.pending}
      <LoaderCircleIcon class="animate-spin" />
    {:else}
      <ChevronRightIcon />
    {/if}
  </button>
</form>
