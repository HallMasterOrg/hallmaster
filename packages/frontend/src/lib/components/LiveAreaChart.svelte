<script lang="ts" generics="T extends { date: Date }">
  import { AreaChart, type AreaChartProps } from "layerchart";
  import { untrack } from "svelte";

  interface Props extends Omit<AreaChartProps<T>, "data" | "xDomain"> {
    value?: T;
  }

  let { value, ...props }: Props = $props();

  let data = $state<NonNullable<AreaChartProps<T>["data"]>>([]);
  let xDomain = $state<AreaChartProps<T>["xDomain"]>();

  $effect(() => {
    if (!value) return;

    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const index = untrack(() => data).findLastIndex(
      ({ date }) => date < oneMinuteAgo,
    );

    data = [...untrack(() => data).slice(index !== -1 ? index : 0), value];

    xDomain = [
      new Date(
        Math.min(
          oneMinuteAgo.getTime(),
          untrack(() => data)[0]?.date.getTime(),
        ),
      ),
      untrack(() => data)[untrack(() => data).length - 1]?.date,
    ];
  });
</script>

<AreaChart {...props} {data} {xDomain} />
