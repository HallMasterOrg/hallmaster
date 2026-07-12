<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { logout } from "$lib/remotes/auth.remote";
  import { LogOutIcon, UserIcon } from "@lucide/svelte";
  import { Avatar } from "@skeletonlabs/skeleton-svelte";
</script>

<div class="flex w-full items-center justify-between gap-2">
  <div class="flex items-center gap-2">
    <Avatar class="size-10 bg-surface-200-800">
      <Avatar.Fallback>
        <UserIcon />
      </Avatar.Fallback>
    </Avatar>

    <p class="text-sm font-bold">User</p>
  </div>

  <form {...logout}>
    <ConfirmButton
      disabled={!!logout.pending}
      icon={{ icon: LogOutIcon }}
      class="hover:text-error-500"
    />
  </form>
</div>
