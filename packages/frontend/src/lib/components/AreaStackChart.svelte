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

  export type AreaStackChartColor = (typeof colors)[number];
</script>

<script lang="ts" generics="T extends { date: Date } = any">
  import { curveCatmullRom } from "d3-shape";
  import { merge } from "es-toolkit/object";
  import { AreaChart, type AreaChartProps } from "layerchart";

  interface Props extends Omit<AreaChartProps<T>, "data" | "seriesLayout" | "series"> {
    data?: Record<string, T[]>;
    color?: AreaStackChartColor;
  }

  let { data, color = "primary", ...props }: Props = $props();
</script>

<AreaChart
  grid={false}
  {...props}
  seriesLayout="stack"
  series={Object.entries(data ?? {}).map(([key, values], index) => ({
    key,
    data: values,
    color: `var(--color-${color}-${shades[index % (shades.length - 1)]})`,
  }))}
  props={merge<NonNullable<AreaChartProps<T>["props"]>, NonNullable<AreaChartProps<T>["props"]>>(
    {
      area: { curve: curveCatmullRom },
      tooltip: {
        root: { class: "preset-filled-surface-100-900!" },
        header: {
          format: (x) => new Date(x).toLocaleTimeString(),
        },
      },
    },
    props.props ?? {},
  )}
/>
