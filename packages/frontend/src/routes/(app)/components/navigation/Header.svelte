<script lang="ts">
  import { getBot } from "$lib/remotes/bot.remote";
  import { type GetBotDto } from "@hallmaster/backend/dto";
  import { BotIcon } from "@lucide/svelte";
  import { Avatar } from "@skeletonlabs/skeleton-svelte";
</script>

{#snippet component(data?: GetBotDto["discord"])}
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
  {const { discord } = await getBot()}

  {@render component(discord)}

  {#snippet pending()}
    {@render component()}
  {/snippet}

  {#snippet failed()}
    {@render component()}
  {/snippet}
</svelte:boundary>
