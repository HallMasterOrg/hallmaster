<script lang="ts" generics="T extends { date: Date }">
  import { curveCatmullRom } from "d3-shape";
  import { merge } from "es-toolkit/object";
  import { AreaChart, type AreaChartProps } from "layerchart";
  import { untrack } from "svelte";

  interface Props extends Omit<AreaChartProps<T>, "data" | "xDomain"> {
    value?: T;
    color?: string;
  }

  let { value, color = "var(--color-primary-500)", ...props }: Props = $props();

  let data = $state.raw<NonNullable<AreaChartProps<T>["data"]>>([]);
  let xDomain = $state<AreaChartProps<T>["xDomain"]>();

  $effect(() => {
    if (!value) return;

    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const index = untrack(() => data).findLastIndex(({ date }) => date < oneMinuteAgo);

    data = [...untrack(() => data).slice(index !== -1 ? index : 0), value];

    xDomain = [
      new Date(Math.min(oneMinuteAgo.getTime(), untrack(() => data)[0]?.date.getTime())),
      untrack(() => data).at(-1)?.date ?? new Date(),
    ];
  });
</script>

<AreaChart
  grid={false}
  {...props}
  {data}
  {xDomain}
  props={merge<NonNullable<AreaChartProps<T>["props"]>, NonNullable<AreaChartProps<T>["props"]>>(
    {
      area: { curve: curveCatmullRom, fill: color, line: { stroke: color } },
      tooltip: {
        root: { class: "preset-filled-surface-100-900!" },
        header: {
          format: (x) => new Date(x).toLocaleTimeString(),
        },
        item: { color },
        context: { color },
      },
      highlight: { points: { fill: color } },
    },
    props.props ?? {},
  )}
/>
