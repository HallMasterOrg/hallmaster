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

<script lang="ts" generics="T extends Record<string, { date: Date }> = any">
  import { curveCatmullRom } from "d3-shape";
  import { merge } from "es-toolkit/object";
  import { AreaChart, type AreaChartProps } from "layerchart";
  import { untrack } from "svelte";

  interface Props extends Omit<AreaChartProps<T>, "data" | "xDomain" | "seriesLayout" | "series"> {
    value?: T;
    color?: (typeof colors)[number];
  }

  let { value, color = "primary", ...props }: Props = $props();

  type Data = Record<keyof T, T[keyof T][]>;
  let data = $state.raw<Data>();
  let xDomain = $state<AreaChartProps<T>["xDomain"]>();

  let keys = $derived<NonNullable<AreaChartProps<T>["series"]>[number]["key"][]>(
    Object.keys(data ?? {}),
  );

  $effect(() => {
    if (!value) return;

    const oneMinuteAgo = new Date(Date.now() - 60_000);
    let latest: Date | undefined;
    let earliest = new Date(oneMinuteAgo);

    if (untrack(() => data)) {
      data = Object.fromEntries(
        [untrack(() => Object.keys(data!)), Object.keys(value)].flat().map((key: keyof T) => {
          const values = untrack(() => data![key]) ?? [];

          const index = values.findLastIndex(({ date }) => date < oneMinuteAgo);
          const updated = [...values.slice(index !== -1 ? index : 0), value[key] ?? []];

          const last = updated.at(-1);
          if (last && last.date > (latest ?? new Date(0))) latest = last.date;
          if (updated[0].date < earliest) earliest = updated[0].date;

          return [key, updated];
        }),
      ) as Data;
    } else {
      data = Object.fromEntries(
        Object.entries(value).map(([key, value]) => [key, [value]]),
      ) as Data;
    }

    xDomain = [earliest, latest ?? new Date()];
  });
</script>

<AreaChart
  grid={false}
  {...props}
  {xDomain}
  seriesLayout="stack"
  series={keys.map((key, index) => ({
    key,
    data: data?.[key],
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
