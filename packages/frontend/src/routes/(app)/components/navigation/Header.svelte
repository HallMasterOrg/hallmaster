<script lang="ts">
  import { getBotProfile } from "$lib/remotes/bot.remote";
  import type { BotDiscordProfile } from "@hallmaster/backend/schemas";
  import { BotIcon } from "@lucide/svelte";
  import { Avatar } from "@skeletonlabs/skeleton-svelte";
</script>

{#snippet component(data?: BotDiscordProfile)}
  <div class="flex w-full items-center gap-2">
    <Avatar class="size-12 rounded-2xl bg-surface-200-800">
      <Avatar.Image src={data?.avatarUrl} />
      <Avatar.Fallback>
        <BotIcon />
      </Avatar.Fallback>
    </Avatar>

    <div class="flex grow flex-col">
      {#if data}
        <h6 class="h6">{data.displayName ?? data.name}</h6>
        <p class="text-xs">{data.name}#{data.discriminator}</p>
      {:else}
        <div class="mb-1 placeholder animate-pulse"></div>
        <div class="placeholder w-4/5 animate-pulse"></div>
      {/if}
    </div>
  </div>
{/snippet}

<svelte:boundary>
  {const profile = await getBotProfile()}

  {@render component(profile)}

  {#snippet pending()}
    {@render component()}
  {/snippet}

  {#snippet failed()}
    {@render component()}
  {/snippet}
</svelte:boundary>
