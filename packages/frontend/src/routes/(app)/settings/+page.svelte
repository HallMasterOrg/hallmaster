<script lang="ts">
  import LabeledInput from "$lib/components/LabeledInput.svelte";
  import {
    getBot,
    updateBotImage,
    updateBotToken,
  } from "$lib/remotes/bot.remote";
  import {
    BracesIcon,
    ContainerIcon,
    LoaderCircleIcon,
    RectangleEllipsisIcon,
    SaveIcon,
    TextCursorIcon,
  } from "@lucide/svelte";
  import { Switch } from "@skeletonlabs/skeleton-svelte";
  import { slide } from "svelte/transition";

  const { dockerImage: defaultValues } = await getBot();
  updateBotImage.fields.dockerImage.username.set(
    defaultValues.username ?? undefined,
  );
  updateBotImage.fields.dockerImage.image.set(defaultValues.image);

  let authentication: boolean = $state(!!defaultValues.username);
</script>

<h6 class="h6 font-normal">Deployment</h6>

<div class="flex flex-col gap-4">
  <form {...updateBotImage} class="flex flex-col gap-3">
    <LabeledInput
      label="Container image url"
      icon={ContainerIcon}
      placeholder="ghcr.io/image:tag"
      required
      {...updateBotImage.fields.dockerImage.image.as("text")}
      issues={updateBotImage.fields.dockerImage.image.issues()}
    >
      {#snippet suffix()}
        <button class="btn-icon btn-icon-sm text-primary-700-300">
          {#if updateBotImage.pending}
            <LoaderCircleIcon class="animate-spin" />
          {:else}
            <SaveIcon />
          {/if}
        </button>
      {/snippet}
    </LabeledInput>

    <Switch
      defaultChecked={authentication}
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
          {...updateBotImage.fields.dockerImage.username.as("text")}
          issues={updateBotImage.fields.dockerImage.username.issues()}
        />

        <LabeledInput
          label="Password"
          icon={RectangleEllipsisIcon}
          required
          {...updateBotImage.fields.dockerImage.password.as("password")}
          issues={updateBotImage.fields.dockerImage.password.issues()}
        />
      </div>
    {/if}
  </form>

  <hr class="hr" />

  <form {...updateBotToken}>
    <LabeledInput
      label="Bot token"
      icon={BracesIcon}
      placeholder="8f0a2f30b4e738362ee19e8e572edb8a"
      required
      {...updateBotToken.fields.token.as("password")}
      issues={updateBotToken.fields.token.issues()}
    >
      {#snippet suffix()}
        <button class="btn-icon btn-icon-sm text-primary-700-300">
          {#if updateBotToken.pending}
            <LoaderCircleIcon class="animate-spin" />
          {:else}
            <SaveIcon />
          {/if}
        </button>
      {/snippet}
    </LabeledInput>
  </form>
</div>
