<script lang="ts">
  import { appbar } from "../+layout.svelte";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

{@render appbar(["Administration", "Settings"])}

<main class="mx-auto flex max-w-2xl flex-col gap-4">
  {@render children()}
</main>
