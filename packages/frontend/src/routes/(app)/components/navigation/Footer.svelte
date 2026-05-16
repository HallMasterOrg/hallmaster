<script lang="ts">
  import { LogOutIcon, UserIcon } from "@lucide/svelte";
  import { Avatar } from "@skeletonlabs/skeleton-svelte";
</script>

<div class="w-full flex justify-between items-center gap-2">
  <div class="flex gap-2 items-center">
    <Avatar class="size-10 bg-surface-200-800">
      <Avatar.Fallback>
        <UserIcon />
      </Avatar.Fallback>
    </Avatar>

    <div class="flex flex-col">
      <p class="text-sm font-bold">Zowks</p>
      <p class="text-xs">zowks.</p>
    </div>
  </div>

  <button class="btn-icon">
    <LogOutIcon />
  </button>
</div>
