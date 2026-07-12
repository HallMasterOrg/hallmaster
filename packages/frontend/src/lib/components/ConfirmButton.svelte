<script lang="ts">
  import { CheckIcon, type Icon } from "@lucide/svelte";
  import type { ComponentProps } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type IconProps = ComponentProps<typeof Icon> & { icon: typeof Icon };

  type Props = HTMLButtonAttributes &
    ({ icon: IconProps; label?: string } | { icon?: IconProps; label: string });

  let { icon, label, ...props }: Props = $props();

  let confirm = $state(false);

  let timer: NodeJS.Timeout | undefined;
  const reset = () =>
    (timer ??= setTimeout(() => {
      confirm = false;
      timer = undefined;
    }, 1500));
</script>

{#if !confirm}
  <button
    {...props}
    type="button"
    class:btn={!!label}
    class:btn-icon={!label}
    onclick={() => (confirm = true)}
  >
    {#if icon}
      {const { icon: Icon, ...props } = icon}
      <Icon {...props} />
    {/if}

    {#if label}
      <span>{label}</span>
    {/if}
  </button>
{:else}
  <!-- svelte-ignore a11y_autofocus -->
  <button
    {...props}
    aria-label="Confirm action"
    class={["preset-tonal-error", props.class]}
    class:btn={!!label}
    class:btn-icon={!label}
    autofocus
    onfocusout={reset}
    onblur={reset}
    onmouseout={reset}
    onmouseover={() => {
      clearTimeout(timer);
      timer = undefined;
    }}
  >
    {#if icon}
      {const { icon: _, ...props } = icon}
      <CheckIcon {...props} />
    {/if}

    {#if label}
      <span>Are you sure?</span>
    {/if}
  </button>
{/if}
