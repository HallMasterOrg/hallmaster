<script lang="ts">
  import DiscordLogin from "$lib/components/DiscordLogin.svelte";
  import { UserIcon } from "@lucide/svelte";
</script>

<div class="card preset-filled-surface-100-900">
  <UserIcon size={64} />

  <DiscordLogin />
</div>
