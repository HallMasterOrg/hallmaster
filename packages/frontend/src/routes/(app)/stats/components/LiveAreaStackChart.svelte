<script lang="ts" module>
  const shades = [800, 700, 600, 500, 400, 300, 200, 100] as const;
  const colors = [
    "primary",
    "secondary",
    "tertiary",
    "success",
    "warning",
    "error",
    "surface",
  ] as const;
</script>

<script lang="ts" generics="T extends { date: Date }">
  import LiveAreaChart from "$lib/components/LiveAreaChart.svelte";
  import type { ComponentProps } from "svelte";

  interface Props extends Omit<ComponentProps<LiveAreaChart<T>>, "seriesLayout" | "series"> {
    color?: (typeof colors)[number];
  }

  let { value, x, color = "primary", ...props }: Props = $props();

  let keys = $derived(Object.keys(value ?? {}).filter((key) => key !== x));
</script>

<LiveAreaChart
  {...props}
  {value}
  {x}
  seriesLayout="stack"
  series={keys.map((key, index) => ({
    key,
    color: `var(--color-${color}-${shades[index % (shades.length - 1)]})`,
  }))}
/>
