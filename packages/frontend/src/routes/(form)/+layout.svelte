<script lang="ts">
import type { LayoutProps } from "./$types";

let { children }: LayoutProps = $props();
</script>

<main class="absolute top-1/2 left-1/2 -translate-1/2 *:form *:w-sm">
  {@render children()}
</main>
