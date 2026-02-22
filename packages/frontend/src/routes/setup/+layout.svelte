<script lang="ts">
import type { LayoutProps } from "./$types";

let { children }: LayoutProps = $props();
</script>

<main class="absolute top-1/2 left-1/2 -translate-1/2 *:flex *:flex-col *:items-center *:gap-4 *:card *:preset-filled-surface-100-900 *:p-6">
    {@render children()}
</main>
