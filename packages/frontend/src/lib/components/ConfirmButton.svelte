<script lang="ts">
  import { CheckIcon, type Icon } from "@lucide/svelte";
  import type { ComponentProps } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type IconProps = ComponentProps<typeof Icon> & { icon: typeof Icon };

  type Props = HTMLAttributes<HTMLButtonElement> &
    ({ icon: IconProps; label?: string } | { icon?: IconProps; label: string });

  let { icon, label, ...props }: Props = $props();

  let confirm = $state(false);
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
  <button
    {...props}
    class={["preset-tonal-error", props.class]}
    class:btn={!!label}
    class:btn-icon={!label}
    onmouseleave={() => setTimeout(() => (confirm = false), 1000)}
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
