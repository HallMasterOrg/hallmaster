<script lang="ts">
  import { RotateCcwIcon } from "@lucide/svelte";
  import { type HttpError } from "@sveltejs/kit";

  interface Props {
    error: unknown;
    reset: () => void;
  }

  let { error, reset }: Props = $props();
</script>

<div class="m-auto">
  <h1 class="h1 text-surface-500">{(error as HttpError).status ?? 500}</h1>
  <h5 class="h5">{(error as HttpError).body?.message ?? "An error occurred"}</h5>
  <button type="button" class="btn preset-filled-primary-500 btn-sm" onclick={reset}>
    <RotateCcwIcon size={16} />
    <span>Retry</span>
  </button>
</div>
