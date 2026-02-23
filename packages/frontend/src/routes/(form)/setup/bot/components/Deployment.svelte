<script lang="ts">
import {
  BracesIcon,
  ContainerIcon,
  RectangleEllipsisIcon,
  TextCursorIcon,
} from "@lucide/svelte";
import { Switch } from "@skeletonlabs/skeleton-svelte";
import LabeledInput from "$lib/components/LabeledInput.svelte";
import { createBot } from "$lib/remotes/bot.remote";

let checked: boolean = $state(false);

const { dockerImage, token } = createBot.fields;
</script>

<div class="flex flex-col gap-4">
  <LabeledInput
    label="Container image url"
    icon={ContainerIcon}
    placeholder="ghcr.io/image:tag"
    required
    {...dockerImage.image.as("text")}
    issues={dockerImage.image.issues()}
  />

  <Switch {checked} onCheckedChange={(details) => (checked = details.checked)}>
    <Switch.Control>
      <Switch.Thumb />
    </Switch.Control>
    <Switch.Label>Registry authentication</Switch.Label>
    <Switch.HiddenInput />
  </Switch>

  {#if checked}
    <div class="flex gap-2">
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
</div>
