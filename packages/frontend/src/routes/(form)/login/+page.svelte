<script lang="ts">
  import DiscordLogin from "$lib/components/DiscordLogin.svelte";
  import { BotIcon } from "@lucide/svelte";
</script>

<div class="card preset-filled-surface-100-900">
  <div class="flex flex-col items-center gap-3 text-center">
    <span class="rounded-container preset-tonal-primary p-3">
      <BotIcon size={32} />
    </span>
    <div>
      <h1 class="h5">HallMaster</h1>
      <p class="text-xs opacity-60">Log in to manage your bot</p>
    </div>
  </div>

  <hr class="hr" />

  <DiscordLogin />
</div>
