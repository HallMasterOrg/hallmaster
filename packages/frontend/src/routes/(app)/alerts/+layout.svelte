<script lang="ts">
  import { page } from "$app/state";
  import { HistoryIcon, SendIcon } from "@lucide/svelte";

  import { appbar } from "../+layout.svelte";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();

  const tabs = [
    { label: "History", icon: HistoryIcon, path: "/alerts" },
    { label: "Discord notifications", icon: SendIcon, path: "/alerts/notifications" },
  ];
</script>

{@render appbar(["Alerts"])}

<main class="mx-auto flex max-w-4xl flex-col gap-4">
  <nav class="flex gap-1 border-b border-surface-200-800" aria-label="Alerts">
    {#each tabs as { label, icon: Icon, path } (path)}
      {@const current = page.url.pathname === path}

      <a
        href={path}
        class={[
          "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm",
          current
            ? "border-primary-500 font-bold"
            : "border-transparent text-surface-700-300 hover:border-surface-300-700",
        ]}
        aria-current={current ? "page" : undefined}
      >
        <Icon size={16} />
        {label}
      </a>
    {/each}
  </nav>

  {@render children()}
</main>
