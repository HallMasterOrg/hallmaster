<script lang="ts">
  import ConfirmButton from "$lib/components/ConfirmButton.svelte";
  import { getEnvironment, updateBotLayout, updateEnvironment } from "$lib/remotes/bot.remote";
  import { getClusters } from "$lib/remotes/clusters.remote";
  import parseDotenv from "$lib/utils/parseDotenv";
  import toaster from "$lib/utils/toaster";
  import {
    EnvironmentVariablesSchema,
    type EnvironmentVariable,
    type EnvironmentVariables,
  } from "@hallmaster/backend/schemas";
  import {
    EyeIcon,
    EyeOffIcon,
    FileUpIcon,
    PlusIcon,
    RotateCwIcon,
    Trash2Icon,
  } from "@lucide/svelte";
  import type { Attachment } from "svelte/attachments";
  import { slide } from "svelte/transition";

  type Row = EnvironmentVariable & { id: string };

  const environment = getEnvironment();
  const clusters = getClusters();

  const toRows = (variables: EnvironmentVariables, previous: Row[] = []): Row[] =>
    variables.map((variable) => ({
      ...variable,
      id: previous.find(({ key }) => key === variable.key)?.id ?? crypto.randomUUID(),
    }));
  const isFilled = ({ key, value }: Row) => key !== "" || value !== "";
  const serialize = (variables: EnvironmentVariables) =>
    JSON.stringify(
      variables.map(({ key, value }) => [key, value]).sort(([a], [b]) => a.localeCompare(b)),
    );

  let rows = $state(toRows(await environment));
  let shown = $state(false);
  let focused = $state<string>();
  let file = $state<HTMLInputElement>();

  let filled = $derived(rows.filter(isFilled));
  let variables = $derived(filled.map(({ key, value }) => ({ key, value })));
  let result = $derived(EnvironmentVariablesSchema.safeParse(variables));
  let changed = $derived(serialize(variables) !== serialize(await environment));
  let deployed = $derived((await clusters).length > 0);
  let issues = $derived.by(() => {
    const issues = new Map<string, string>();

    for (const { path, message } of result.error?.issues ?? []) {
      const row = filled[path[0] as number];
      if (row !== undefined && !issues.has(row.id)) issues.set(row.id, message);
    }

    return issues;
  });

  const focus: Attachment<HTMLInputElement> = (input) => {
    if (input.dataset.row === focused) input.focus();
  };

  function add() {
    const [row] = toRows([{ key: "", value: "" }]);
    rows.push(row);
    focused = row.id;
  }

  function remove(id: Row["id"]) {
    rows = rows.filter((row) => row.id !== id);
  }

  function merge(imported: EnvironmentVariables) {
    if (imported.length === 0) {
      toaster.warning({ title: "No variable found", description: "Use one KEY=value per line" });
      return;
    }

    const kept = rows.filter(isFilled);
    for (const variable of imported) {
      const row = kept.find(({ key }) => key === variable.key);
      if (row === undefined) kept.push(...toRows([variable]));
      else row.value = variable.value;
    }

    rows = kept;
    toaster.info({
      title: `${imported.length} variable${imported.length === 1 ? "" : "s"} added`,
      description: "Save to keep them",
    });
  }

  function paste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData("text") ?? "";
    if (!text.includes("=")) return;

    event.preventDefault();
    merge(parseDotenv(text));
  }

  async function importFile(input: HTMLInputElement) {
    const [selected] = input.files ?? [];
    input.value = "";
    if (selected !== undefined) merge(parseDotenv(await selected.text()));
  }

  async function reset() {
    rows = toRows(await environment, rows);
  }

  function save() {
    toaster.promise(
      updateEnvironment(variables).then(() => {
        rows = rows.filter(isFilled);
      }),
      {
        loading: { title: "Saving environment.." },
        success: {
          title: "Environment saved",
          description: "Redeploy the clusters to give it to them",
        },
        error: (error) => ({
          title: "Error",
          description: JSON.parse(error as string)?.message ?? "An error occurred",
        }),
      },
    );
  }

  async function redeploy() {
    const layout = (await clusters).map(({ id, shardIds }) => ({ id, shardIds }));

    toaster.promise(updateBotLayout(layout), {
      loading: { title: "Redeploying clusters.." },
      success: { title: "Clusters redeployed" },
      error: (error) => ({
        title: "Error",
        description: JSON.parse(error as string)?.message ?? "An error occurred",
      }),
    });
  }
</script>

<section class="flex flex-col gap-3" aria-labelledby="environment-title">
  <header class="flex items-start justify-between gap-4">
    <div class="flex flex-col gap-0.5">
      <h6 id="environment-title" class="h6 font-normal">Environment</h6>
      <p class="text-xs text-surface-700-300">
        Given to every cluster when it is deployed. Paste a whole .env into a name field to add its
        variables.
      </p>
    </div>

    <div class="flex shrink-0 gap-1">
      <button
        type="button"
        class="btn-icon btn-icon-sm preset-tonal"
        aria-label={shown ? "Hide values" : "Show values"}
        aria-pressed={shown}
        onclick={() => (shown = !shown)}
      >
        {#if shown}
          <EyeOffIcon size={16} />
        {:else}
          <EyeIcon size={16} />
        {/if}
      </button>

      <button type="button" class="btn preset-tonal btn-sm" onclick={() => file?.click()}>
        <FileUpIcon size={16} /> Import .env
      </button>
      <input
        bind:this={file}
        type="file"
        class="hidden"
        aria-label="Import a .env file"
        onchange={(event) => importFile(event.currentTarget)}
      />
    </div>
  </header>

  {#if rows.length === 0}
    <p
      class="card border border-dashed border-surface-300-700 p-4 text-center text-sm text-surface-700-300"
    >
      No variables yet
    </p>
  {:else}
    <ul class="flex flex-col gap-2" aria-label="Environment variables">
      {#each rows as row (row.id)}
        {@const issue = issues.get(row.id)}

        <li class="flex flex-col gap-1" transition:slide={{ duration: 150 }}>
          <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
            <input
              class={["input font-mono text-sm", issue && "border-error-500"]}
              placeholder="NAME"
              aria-label="Name"
              aria-invalid={!!issue}
              autocomplete="off"
              spellcheck="false"
              data-row={row.id}
              bind:value={row.key}
              onpaste={paste}
              {@attach focus}
            />
            <input
              class="input font-mono text-sm"
              type={shown ? "text" : "password"}
              placeholder="value"
              aria-label={`Value of ${row.key || "the new variable"}`}
              autocomplete="off"
              spellcheck="false"
              bind:value={row.value}
            />
            <button
              type="button"
              class="btn-icon btn-icon-sm hover:preset-tonal-error"
              aria-label={`Remove ${row.key || "the new variable"}`}
              onclick={() => remove(row.id)}
            >
              <Trash2Icon size={16} />
            </button>
          </div>

          {#if issue}
            <p class="ml-1 text-xs text-error-500" role="alert">{issue}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <footer class="flex items-center justify-between gap-2">
    <button type="button" class="btn preset-tonal btn-sm" onclick={add}>
      <PlusIcon size={16} /> Add variable
    </button>

    <div class="flex gap-2">
      <button
        type="button"
        class="btn btn-sm not-disabled:hover:underline"
        disabled={!changed}
        onclick={reset}
      >
        Reset
      </button>
      <button
        type="button"
        class="btn preset-filled-primary-500 btn-sm"
        disabled={!changed || !result.success || !!updateEnvironment.pending}
        onclick={save}
      >
        Save
      </button>
    </div>
  </footer>

  <aside class="flex items-center justify-between gap-3 card preset-tonal-surface p-3">
    <p class="text-xs text-surface-700-300">
      Running clusters keep the variables they started with until they are redeployed.
    </p>
    <ConfirmButton
      label="Redeploy clusters"
      icon={{ icon: RotateCwIcon, size: 16 }}
      class="shrink-0 preset-tonal btn-sm"
      title={changed
        ? "Save your changes first"
        : deployed
          ? undefined
          : "No cluster is deployed yet"}
      disabled={changed || !deployed || !!updateBotLayout.pending}
      onclick={redeploy}
    />
  </aside>
</section>
