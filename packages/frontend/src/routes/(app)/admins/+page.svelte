<script lang="ts">
  import BoundaryFailed from "$lib/components/BoundaryFailed.svelte";
  import { getUser } from "$lib/remotes/auth.remote";
  import { getUsers } from "$lib/remotes/users.remote";
  import { InfoIcon } from "@lucide/svelte";
  import { flip } from "svelte/animate";
  import { slide } from "svelte/transition";

  import AddAdmin from "./components/AddAdmin.svelte";
  import AdminRow from "./components/AdminRow.svelte";

  const me = getUser();
  const users = getUsers();
</script>

<div>
  <h6 class="h6 font-normal">Admins</h6>
  <p class="text-xs opacity-60">
    These Discord accounts can log in and manage the bot. The owner also manages this list.
  </p>
</div>

<svelte:boundary>
  {#if (await me).role === "OWNER"}
    <AddAdmin />
  {:else}
    <p class="flex items-center gap-2 card preset-tonal-surface p-3 text-xs">
      <InfoIcon class="shrink-0" size={16} />
      Only the owner can add admins, remove them or hand over the instance.
    </p>
  {/if}

  <ul class="flex flex-col gap-2" aria-label="Admins">
    {#each await users as user (user.id)}
      <li
        class="flex items-center gap-3 card preset-outlined-surface-200-800 p-3"
        animate:flip={{ duration: 200 }}
        transition:slide={{ duration: 150 }}
      >
        <AdminRow {user} me={await me} />
      </li>
    {/each}
  </ul>

  {#snippet pending()}
    <ul class="flex flex-col gap-2">
      {#each { length: 2 }}
        <li class="flex items-center gap-3 card preset-outlined-surface-200-800 p-3">
          <div class="placeholder-circle size-10 animate-pulse"></div>
          <div class="flex grow flex-col gap-1">
            <div class="placeholder w-32 animate-pulse"></div>
            <div class="placeholder w-48 animate-pulse"></div>
          </div>
        </li>
      {/each}
    </ul>
  {/snippet}

  {#snippet failed(error, reset)}
    <BoundaryFailed {error} {reset} />
  {/snippet}
</svelte:boundary>
