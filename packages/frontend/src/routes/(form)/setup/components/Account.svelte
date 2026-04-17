<script lang="ts">
  import LabeledInput from "$lib/components/LabeledInput.svelte";
  import { register } from "$lib/remotes/auth.remote";
  import toaster from "$lib/utils/toaster";
  import {
    ChevronRightIcon,
    LoaderCircleIcon,
    RectangleEllipsisIcon,
    TextCursorIcon,
  } from "@lucide/svelte";
</script>

<form
  {...register.enhance(async ({ submit, form }) => {
    await submit()
      .then(() => form.reset())
      .catch((error) =>
        toaster.create({
          type: "error",
          title: "Error",
          description: JSON.parse(error).message,
        }),
      );
  })}
>
  <LabeledInput
    label="Username"
    icon={TextCursorIcon}
    required
    {...register.fields.username.as("text")}
    issues={register.fields.username.issues()}
  />
  <LabeledInput
    label="Password"
    icon={RectangleEllipsisIcon}
    required
    {...register.fields.password.as("password")}
    issues={register.fields.password.issues()}
  />

  <button
    class="btn text-sm preset-filled-primary-500"
    disabled={!!register.pending}
  >
    Create account
    {#if register.pending}
      <LoaderCircleIcon class="animate-spin" />
    {:else}
      <ChevronRightIcon />
    {/if}
  </button>
</form>
