<script lang="ts">
import {
  ChevronRightIcon,
  EllipsisIcon,
  PlusIcon,
  RectangleEllipsisIcon,
  TextCursorIcon,
  UserIcon,
} from "@lucide/svelte";
import { Steps } from "@skeletonlabs/skeleton-svelte";
import LabeledInput from "$lib/components/LabeledInput.svelte";
import { register } from "$lib/remotes/auth.remote";
import toaster from "$lib/utils/toaster";
</script>

<div>
  <UserIcon size={64} />

  <Steps count={2}>
    <Steps.List>
      <Steps.Item index={0}>
        <Steps.Trigger>
          <Steps.Indicator>
            <PlusIcon size={16} />
          </Steps.Indicator>
          <span>Create account</span>
        </Steps.Trigger>
        <Steps.Separator />
      </Steps.Item>
      <Steps.Item index={1}>
        <Steps.Indicator>
          <EllipsisIcon size={16} />
        </Steps.Indicator>
      </Steps.Item>
    </Steps.List>
  </Steps>

  <form
    class="flex flex-col gap-4"
    {...register.enhance(({ submit }) => submit().catch(error => {
      toaster.create({
        type: "error",
        title: "Error",
        description: JSON.parse(error).message,
      });
    }))}
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

      <button class="btn text-sm preset-filled-primary-500">
        Create account
        <ChevronRightIcon />
      </button>
  </form>
</div>
