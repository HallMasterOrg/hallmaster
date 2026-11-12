<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { removeAdmin, transferOwnership } from "$lib/remotes/users.remote";
  import toaster from "$lib/utils/toaster";
  import type { User } from "@hallmaster/backend/schemas";
  import { CrownIcon, ShieldUserIcon, UserIcon, UserXIcon } from "@lucide/svelte";
  import { Avatar } from "@skeletonlabs/skeleton-svelte";

  type Props = {
    user: User;
    me: User;
  };

  let { user, me }: Props = $props();

  let name = $derived(user.displayName ?? user.username);

  const addedOn = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  const error = (error: unknown) => ({
    title: "Error",
    description: JSON.parse(error as string)?.message ?? "An error occurred",
  });

  function makeOwner() {
    toaster.promise(transferOwnership(user.id), {
      loading: { title: `Transferring the ownership to ${name}..` },
      success: { title: `${name} is now the owner` },
      error,
    });
  }

  function remove() {
    toaster.promise(removeAdmin(user.id), {
      loading: { title: `Removing ${name}..` },
      success: { title: `${name} can no longer log in` },
      error,
    });
  }
</script>

<Avatar class="size-10 shrink-0 bg-surface-200-800">
  <Avatar.Image src={user.avatarUrl} />
  <Avatar.Fallback>
    <UserIcon />
  </Avatar.Fallback>
</Avatar>

<div class="flex min-w-0 grow flex-col">
  <p class="flex items-center gap-2 text-sm font-bold">
    <span class="truncate">{name}</span>
    {#if user.id === me.id}
      <span class="text-2xs badge preset-tonal-primary">You</span>
    {/if}
  </p>
  <p class="truncate text-xs opacity-60">
    @{user.username} · added {addedOn.format(new Date(user.createdAt))}
  </p>
</div>

{#if user.role === "OWNER"}
  <span class="badge preset-tonal-warning">
    <CrownIcon size={14} />
    Owner
  </span>
{:else}
  <span class="badge preset-tonal-surface">
    <ShieldUserIcon size={14} />
    Admin
  </span>

  {#if me.role === "OWNER"}
    <div class="flex gap-1">
      <ConfirmButton
        aria-label={`Make ${name} the owner`}
        title="Make owner"
        icon={{ icon: CrownIcon, size: 18 }}
        class="hover:text-warning-500"
        onclick={makeOwner}
      />
      <ConfirmButton
        aria-label={`Remove ${name}`}
        title="Remove"
        icon={{ icon: UserXIcon, size: 18 }}
        class="hover:text-error-500"
        onclick={remove}
      />
    </div>
  {/if}
{/if}
