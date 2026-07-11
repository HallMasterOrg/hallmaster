<script lang="ts">
  import BoundaryFailed from "$lib/components/BoundaryFailed.svelte";
  import LabeledInput from "$lib/components/LabeledInput.svelte";
  import { getBot, updateBotImage, updateBotToken } from "$lib/remotes/bot.remote";
  import toaster from "$lib/utils/toaster";
  import {
    BracesIcon,
    ContainerIcon,
    RectangleEllipsisIcon,
    SaveIcon,
    TextCursorIcon,
  } from "@lucide/svelte";
  import { Switch } from "@skeletonlabs/skeleton-svelte";
  import { slide } from "svelte/transition";
</script>

<h6 class="h6 font-normal">Deployment</h6>

<div class="flex flex-col gap-4">
  <svelte:boundary>
    <form
      {...updateBotImage.enhance(({ submit, element }) => {
        toaster.promise(submit(), {
          loading: { title: "Updating deployment config.." },
          success: () => {
            element.reset();
            return { title: "Successfully applied deployment config" };
          },
          error: (error) => ({
            title: "Error",
            description: JSON.parse(error as string)?.message ?? "An error occurred",
          }),
        });
      })}
      class="flex flex-col gap-3"
    >
      {const { dockerImage: defaultValues } = await getBot()}
      {let authentication = $state(!!defaultValues.username)}

      <LabeledInput
        label="Container image url"
        icon={ContainerIcon}
        placeholder="ghcr.io/image:tag"
        required
        {...updateBotImage.fields.dockerImage.image.as("text", defaultValues.image)}
        issues={updateBotImage.fields.dockerImage.image.issues()}
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
            {...updateBotImage.fields.dockerImage.username.as("text", defaultValues.username ?? "")}
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
          return { title: "Successfully registered token" };
        },
        error: (error) => ({
          title: "Error",
          description: JSON.parse(error as string)?.message ?? "An error occurred",
        }),
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
</div>
