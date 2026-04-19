<script lang="ts">
  import { page } from "$app/state";
  import { BotIcon, UserIcon, type Icon } from "@lucide/svelte";
  import { Steps } from "@skeletonlabs/skeleton-svelte";
  import type { Component } from "svelte";
  import Account from "./components/Account.svelte";
  import Bot from "./components/Bot.svelte";

  type Step = {
    title: string;
    icon: typeof Icon;
    content: Component;
  };

  const steps: Step[] = [
    { title: "account", icon: UserIcon, content: Account },
    { title: "bot", icon: BotIcon, content: Bot },
  ];

  let step: number = $derived(
    steps.findLastIndex(
      ({ title }, index) => title === page.url.hash.slice(1) || index === 0,
    ),
  );
</script>

<Steps {step} count={steps.length}>
  {@const Icon = steps[step].icon}
  <div class="flex gap-2 justify-center">
    <Icon class="flex-2" size={64} />
    <div class="flex-5">
      <p class="text-sm font-bold">Welcome aboard</p>
      <p class="text-xs">Let's set things up in a few clicks.</p>
    </div>
  </div>

  <Steps.List>
    {#each steps as { title, icon }, index}
      {@const IndicatorIcon = icon}
      <Steps.Item {index}>
        <Steps.Indicator>
          <IndicatorIcon size={16} />
        </Steps.Indicator>
        <span class="capitalize">{title}</span>
        <Steps.Separator />
      </Steps.Item>
    {/each}
  </Steps.List>

  {#each steps as { content }, index}
    {@const Content = content}
    <Steps.Content {index} class="*:flex *:flex-col *:gap-4">
      <Content />
    </Steps.Content>
  {/each}
</Steps>
