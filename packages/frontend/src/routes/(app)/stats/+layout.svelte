<script lang="ts">
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

<main class="flex flex-col gap-4 max-w-4xl mx-auto">
  {@render children()}
</main>
