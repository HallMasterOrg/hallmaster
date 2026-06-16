<script lang="ts">
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

<main class="absolute top-1/2 left-1/2 -translate-1/2 *:form *:w-sm">
  {@render children()}
</main>

<span>
  <style>
    body {
      background-image: radial-gradient(
        rgba(255, 255, 255, 0.05) 1px,
        transparent 1px
      );
      background-size: 15px 15px;
      background-attachment: fixed;
    }
  </style>
</span>
