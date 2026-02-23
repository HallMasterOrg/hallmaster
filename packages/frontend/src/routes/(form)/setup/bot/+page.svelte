<script lang="ts">
import {
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PackageIcon,
  ScalingIcon,
  UserIcon,
} from "@lucide/svelte";
import { Steps } from "@skeletonlabs/skeleton-svelte";

import { createBot } from "$lib/remotes/bot.remote";
import toaster from "$lib/utils/toaster";
import Deployment from "./components/Deployment.svelte";
import Scaling from "./components/Scaling.svelte";

let step = $state(0);
const steps = [
  { title: "Deployment", icon: PackageIcon, content: Deployment },
  { title: "Scaling", icon: ScalingIcon, content: Scaling },
];
</script>

<form
  {...createBot.enhance(({ submit }) =>
    submit().catch((error) => {
      toaster.create({
        type: "error",
        title: "Error",
        description: JSON.parse(error).message,
      });
    }),
  )}
>
  <BotIcon size={64} />

  <Steps
    count={steps.length}
    onStepChange={(details) => (step = details.step)}
    class="w-full"
  >
    <Steps.List>
      <Steps.Item index={-1}>
        <Steps.Indicator>
          <UserIcon size={16} />
        </Steps.Indicator>
        <Steps.Separator />
      </Steps.Item>
      {#each steps as item, index}
        {@const Icon = item.icon}
        <Steps.Item {index}>
          <Steps.Trigger>
            <Steps.Indicator>
              <Icon size={16} />
            </Steps.Indicator>
            <span>{item.title}</span>
          </Steps.Trigger>
          {#if index < steps.length - 1}
            <Steps.Separator />
          {/if}
        </Steps.Item>
      {/each}
    </Steps.List>

    {#each steps as item, index}
      {@const Content = item.content}
      <Steps.Content {index}>
        <Content />
      </Steps.Content>
    {/each}

    <div class="flex items-center gap-2">
      <Steps.PrevTrigger class="btn-icon preset-tonal">
        <ChevronLeftIcon />
      </Steps.PrevTrigger>
      {#if step != steps.length - 1}
        <Steps.NextTrigger class="flex-1 btn text-sm preset-tonal">
          <span>Next</span>
          <ChevronRightIcon />
        </Steps.NextTrigger>
      {:else}
        <button class="flex-1 btn text-sm preset-filled-primary-500">
          <span>Submit</span>
          <ChevronRightIcon />
        </button>
      {/if}
    </div>
  </Steps>
</form>
