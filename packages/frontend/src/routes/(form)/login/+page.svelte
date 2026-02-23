<script lang="ts">
import {
  ChevronRightIcon,
  RectangleEllipsisIcon,
  TextCursorIcon,
  UserIcon,
} from "@lucide/svelte";
import LabeledInput from "$lib/components/LabeledInput.svelte";
import { login } from "$lib/remotes/auth.remote";
import toaster from "$lib/utils/toaster";
</script>

<form
  class="card preset-filled-surface-100-900"
  {...login.enhance(({ submit }) =>
    submit().catch((error) => {
      toaster.create({
        type: "error",
        title: "Error",
        description: JSON.parse(error).message,
      });
    }),
  )}
>
  <UserIcon size={64} />

  <LabeledInput
    label="Username"
    required
    icon={TextCursorIcon}
    {...login.fields.username.as("text")}
    issues={login.fields.username.issues()}
  />

  <LabeledInput
    label="Password"
    required
    icon={RectangleEllipsisIcon}
    {...login.fields.password.as("password")}
    issues={login.fields.password.issues()}
  />

  <button class="btn text-sm preset-filled-primary-500">
    Login
    <ChevronRightIcon />
  </button>
</form>
