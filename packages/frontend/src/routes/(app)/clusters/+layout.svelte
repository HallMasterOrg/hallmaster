<script lang="ts">
  import { appbar } from "../+layout.svelte";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

{@render appbar(["Clusters"])}

<main class="mx-auto max-w-6xl">
  {@render children()}
</main>
