<script lang="ts">
  import BoundaryFailed from "$lib/components/BoundaryFailed.svelte";
  import LabeledInput from "$lib/components/LabeledInput.svelte";
  import { getContainerImage, updateBotImage, updateBotToken } from "$lib/remotes/bot.remote";
  import toaster from "$lib/utils/toaster";
  import toastError from "$lib/utils/toastError";
  import {
    BracesIcon,
    ContainerIcon,
    RectangleEllipsisIcon,
    SaveIcon,
    TextCursorIcon,
  } from "@lucide/svelte";
  import { Switch } from "@skeletonlabs/skeleton-svelte";
  import { slide } from "svelte/transition";

  import EnvironmentVariables from "./components/EnvironmentVariables.svelte";
  import RedeployClusters from "./components/RedeployClusters.svelte";
</script>

<header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
  <h6 class="h6 font-normal">Deployment</h6>

  <svelte:boundary>
    <RedeployClusters />

    {#snippet pending()}
      <div class="h-8 placeholder w-44 animate-pulse"></div>
    {/snippet}
  </svelte:boundary>
</header>

<div class="flex flex-col gap-4">
  <svelte:boundary>
    <form
      {...updateBotImage.enhance(({ submit, element }) => {
        toaster.promise(submit(), {
          loading: { title: "Updating deployment config.." },
          success: () => {
            element.reset();
            return {
              title: "Successfully applied deployment config",
              description: "Redeploy the clusters to apply it",
            };
          },
          error: toastError,
        });
      })}
      class="flex flex-col gap-3"
    >
      {const defaultValues = await getContainerImage()}
      {let authentication = $state(!!defaultValues.username)}

      <LabeledInput
        label="Container image url"
        icon={ContainerIcon}
        placeholder="ghcr.io/image:tag"
        required
        {...updateBotImage.fields.url.as("text", defaultValues.url)}
        issues={updateBotImage.fields.url.issues()}
      >
        {#snippet suffix()}
          <button
            class="btn-icon btn-icon-sm text-primary-700-300"
            disabled={!!updateBotImage.pending}
          >
            <SaveIcon />
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
            {...updateBotImage.fields.username.as("text", defaultValues.username ?? "")}
            issues={updateBotImage.fields.username.issues()}
          />

          <LabeledInput
            label="Password"
            icon={RectangleEllipsisIcon}
            required
            {...updateBotImage.fields.password.as("password")}
            issues={updateBotImage.fields.password.issues()}
          />
        </div>
      {/if}
    </form>

    {#snippet failed(error, reset)}
      <BoundaryFailed {error} {reset} />
    {/snippet}
  </svelte:boundary>

  <hr class="hr" />

  <form
    {...updateBotToken.enhance(({ submit, element }) => {
      toaster.promise(submit(), {
        loading: { title: "Updating token.." },
        success: () => {
          element.reset();
          return {
            title: "Successfully registered token",
            description: "Redeploy the clusters to apply it",
          };
        },
        error: toastError,
      });
    })}
  >
    <LabeledInput
      label="Bot token"
      icon={BracesIcon}
      placeholder="8f0a2f30b4e738362ee19e8e572edb8a"
      required
      {...updateBotToken.fields.token.as("password")}
      issues={updateBotToken.fields.token.issues()}
    >
      {#snippet suffix()}
        <button
          class="btn-icon btn-icon-sm text-primary-700-300"
          disabled={!!updateBotToken.pending}
        >
          <SaveIcon />
        </button>
      {/snippet}
    </LabeledInput>
  </form>

  <hr class="hr" />

  <svelte:boundary>
    <EnvironmentVariables />

    {#snippet pending()}
      <div class="h-40 placeholder animate-pulse"></div>
    {/snippet}

    {#snippet failed(error, reset)}
      <BoundaryFailed {error} {reset} />
    {/snippet}
  </svelte:boundary>
</div>
