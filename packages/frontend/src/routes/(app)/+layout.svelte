<script lang="ts">
  import Navigation from "./components/navigation/Navigation.svelte";

  import { page } from "$app/state";
  import {
    BotIcon,
    BoxesIcon,
    ChartAreaIcon,
    ChevronRightIcon,
    LayoutDashboardIcon,
  } from "@lucide/svelte";
  import { AppBar } from "@skeletonlabs/skeleton-svelte";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();

  const items = {
    clusters: [
      { label: "Home", icon: BoxesIcon, path: "/clusters" },
      { label: "Layout", icon: LayoutDashboardIcon, path: "/layout" },
      { label: "Statistics", icon: ChartAreaIcon, path: "/stats" },
    ],
    settings: [{ label: "Bot", icon: BotIcon, path: "/settings" }],
  };

  let [group, label] = $derived.by(() => {
    for (const [group, links] of Object.entries(items)) {
      for (const link of links) {
        if (page.url.pathname !== link.path) continue;

        return [group, link.label];
      }
    }

    return [];
  });
</script>

<div class="grid grid-cols-[auto_1fr]">
  <Navigation {items} />

  <div>
    <AppBar class="bg-surface-50-950">
      <AppBar.Toolbar class="grid-cols-[1fr_2fr_1fr]">
        <AppBar.Lead>
          <ol class="flex items-center gap-2 text-xs">
            <li class="capitalize font-bold">{group}</li>
            <li class="opacity-50" aria-hidden="true">
              <ChevronRightIcon size={10} />
            </li>
            <li>{label}</li>
          </ol>
        </AppBar.Lead>
      </AppBar.Toolbar>
    </AppBar>

    {@render children()}
  </div>
</div>
