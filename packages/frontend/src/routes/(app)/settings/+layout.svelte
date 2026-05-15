<script lang="ts">
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

<main class="max-w-2xl flex flex-col gap-4 mx-auto">
  {@render children()}
</main>
