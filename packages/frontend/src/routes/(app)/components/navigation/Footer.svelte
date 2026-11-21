<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { getUser, logout } from "$lib/remotes/auth.remote";
  import type { User } from "@hallmaster/backend/schemas";
  import { LogOutIcon, UserIcon } from "@lucide/svelte";
  import { Avatar } from "@skeletonlabs/skeleton-svelte";
</script>

{#snippet profile(user?: User)}
  <div class="flex min-w-0 items-center gap-2">
    <Avatar class="size-10 shrink-0 bg-surface-200-800">
      <Avatar.Image src={user?.avatarUrl} />
      <Avatar.Fallback>
        <UserIcon />
      </Avatar.Fallback>
    </Avatar>

    <div class="flex min-w-0 flex-col">
      {#if user}
        <p class="truncate text-sm font-bold">{user.displayName ?? user.username}</p>
        <p class="truncate text-xs opacity-60">@{user.username}</p>
      {:else}
        <div class="mb-1 placeholder w-20 animate-pulse"></div>
        <div class="placeholder w-14 animate-pulse"></div>
      {/if}
    </div>
  </div>
{/snippet}

<div class="flex w-full items-center justify-between gap-2">
  <svelte:boundary>
    {@render profile(await getUser())}

    {#snippet pending()}
      {@render profile()}
    {/snippet}

    {#snippet failed()}
      {@render profile()}
    {/snippet}
  </svelte:boundary>

  <form {...logout}>
    <ConfirmButton
      aria-label="Log out"
      disabled={!!logout.pending}
      icon={{ icon: LogOutIcon }}
      class="hover:text-error-500"
    />
  </form>
</div>
