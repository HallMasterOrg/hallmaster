<script lang="ts">
  import { page } from "$app/state";
  import { isLoginError, loginErrors } from "$lib/loginErrors";
  import { ChevronRightIcon, TriangleAlertIcon } from "@lucide/svelte";

  let error = $derived(page.url.searchParams.get("error"));
</script>

{#if isLoginError(error)}
  <p class="flex items-center gap-2 text-sm text-error-500" role="alert">
    <TriangleAlertIcon class="shrink-0" size={16} />
    {loginErrors[error]}
  </p>
{/if}

<a class="btn preset-filled-primary-500 text-sm" href="/login/discord" data-sveltekit-reload>
  Continue with Discord
  <ChevronRightIcon />
</a>
