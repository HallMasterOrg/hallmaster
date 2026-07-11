<script lang="ts" module>
  export { appbar };
</script>

<script lang="ts">
  import {
    ChartAreaIcon,
    ChevronRightIcon,
    ContainerIcon,
    LayoutDashboardIcon,
    SettingsIcon,
  } from "@lucide/svelte";
  import { AppBar } from "@skeletonlabs/skeleton-svelte";

  import type { LayoutProps } from "./$types";
  import Navigation from "./components/navigation/Navigation.svelte";

  let { children, params }: LayoutProps = $props();

  const items = {
    "": [
      { label: "Clusters", icon: ContainerIcon, path: "/clusters" },
      { label: "Statistics", icon: ChartAreaIcon, path: "/stats" },
    ],
    administration: [
      { label: "Layout", icon: LayoutDashboardIcon, path: "/layout" },
      { label: "Settings", icon: SettingsIcon, path: "/settings" },
    ],
  };
</script>

{#snippet appbar(breadcrumbs: string[])}
  <AppBar class="bg-surface-50-950">
    <AppBar.Toolbar class="grid-cols-[1fr_2fr_1fr]">
      <AppBar.Lead>
        <ol class="flex items-center gap-2 text-xs">
          {#each breadcrumbs as label, index}
            {#if index !== 0}
              <li class="opacity-50" aria-hidden="true">
                <ChevronRightIcon size={14} />
              </li>
            {/if}

            <li class="capitalize">{label}</li>
          {/each}
        </ol>
      </AppBar.Lead>
    </AppBar.Toolbar>
  </AppBar>
{/snippet}

<div class="grid grid-cols-[auto_1fr]">
  <Navigation {items} />

  <div class="px-4">
    {@render children()}

    <footer class="h-12"></footer>
  </div>
</div>
