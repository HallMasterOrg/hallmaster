<script lang="ts">
  import { page } from "$app/state";
  import type { Icon } from "@lucide/svelte";
  import { Navigation } from "@skeletonlabs/skeleton-svelte";

  import Footer from "./Footer.svelte";
  import Header from "./Header.svelte";

  interface Props {
    items: Record<string, { label: string; icon: typeof Icon; path: string }[]>;
  }

  let { items }: Props = $props();
</script>

<div class="flex">
  <Navigation
    layout="sidebar"
    class="sticky top-0 grid h-screen grid-rows-[auto_1fr_auto] gap-4 bg-surface-50-950"
  >
    <Navigation.Header class="flex items-center gap-2">
      <Header />
    </Navigation.Header>

    <Navigation.Content>
      {#each Object.entries(items) as [category, links]}
        <Navigation.Group>
          <Navigation.Label class="pl-2 capitalize">
            {category}
          </Navigation.Label>

          <Navigation.Menu>
            {#each links as { icon, label, path }}
              {@const Icon = icon}
              <Navigation.TriggerAnchor
                href={path}
                class={{ "preset-filled-surface-100-900": path === page.url.pathname }}
              >
                <Icon class="size-4" />
                <Navigation.TriggerText>{label}</Navigation.TriggerText>
              </Navigation.TriggerAnchor>
            {/each}
          </Navigation.Menu>
        </Navigation.Group>
      {/each}
    </Navigation.Content>

    <Navigation.Footer>
      <Footer />
    </Navigation.Footer>
  </Navigation>
  <span class="vr"></span>
</div>
