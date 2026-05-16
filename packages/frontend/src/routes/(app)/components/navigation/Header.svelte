<script lang="ts">
  import { BotIcon } from "@lucide/svelte";
  import { Avatar } from "@skeletonlabs/skeleton-svelte";
</script>

<div class="w-full flex justify-between items-center gap-2">
  <div class="flex gap-2 items-center">
    <Avatar class="size-12 rounded-2xl bg-surface-200-800">
      <Avatar.Fallback>
        <BotIcon />
      </Avatar.Fallback>
    </Avatar>

    <div class="flex flex-col">
      <h6 class="h6">Hallmaster</h6>
      <p class="text-xs">hallmaster#1234</p>
    </div>
  </div>
</div>
