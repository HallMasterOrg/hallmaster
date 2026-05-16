<script lang="ts">
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

<main class="max-w-6xl mx-auto">
  {@render children()}
</main>
