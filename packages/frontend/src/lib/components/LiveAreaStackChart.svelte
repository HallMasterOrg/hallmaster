<script lang="ts" generics="T extends Record<string, { date: Date }> = any">
  import type { AreaChartProps } from "layerchart";
  import { untrack } from "svelte";

  import AreaStackChart, { type AreaStackChartColor } from "./AreaStackChart.svelte";

  interface Props extends Omit<AreaChartProps<T>, "data" | "xDomain" | "seriesLayout" | "series"> {
    value?: T;
    color?: AreaStackChartColor;
  }

  let { value, color = "primary", ...props }: Props = $props();

  type Data = Record<keyof T, T[keyof T][]>;
  let data = $state.raw<Data>();
  let xDomain = $state<AreaChartProps<T>["xDomain"]>();

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

<AreaStackChart {...props} {data} {xDomain} {color} />
