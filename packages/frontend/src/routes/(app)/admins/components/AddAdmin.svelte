<script lang="ts">
  import LabeledInput from "$lib/components/LabeledInput.svelte";
  import { addAdmin } from "$lib/remotes/users.remote";
  import toaster from "$lib/utils/toaster";
  import { AddUserSchema } from "@hallmaster/backend/schemas";
  import { FingerprintIcon, UserPlusIcon } from "@lucide/svelte";

  let issues = $derived(addAdmin.fields.id.issues());
</script>

<form
  {...addAdmin.preflight(AddUserSchema).enhance(async ({ submit, element }) => {
    try {
      if (!(await submit())) return;

      element.reset();
      toaster.success({ title: "Admin added, they can now log in with Discord" });
    } catch (error) {
      toaster.error({
        title: "Error",
        description: JSON.parse(error as string)?.message ?? "An error occurred",
      });
    }
  })}
  class="flex flex-col gap-2 card preset-filled-surface-100-900 p-4"
>
  <LabeledInput
    label="Discord user ID"
    icon={FingerprintIcon}
    placeholder="123456789012345678"
    inputmode="numeric"
    autocomplete="off"
    required
    {...addAdmin.fields.id.as("text")}
    {issues}
  >
    {#snippet suffix()}
      <button class="btn preset-filled-primary-500 btn-sm" disabled={!!addAdmin.pending}>
        <UserPlusIcon size={16} />
        Add admin
      </button>
    {/snippet}
  </LabeledInput>

  {#if issues}
    <p class="text-xs text-error-500" role="alert">{issues[0].message}</p>
  {/if}
</form>
