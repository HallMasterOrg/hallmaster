<script lang="ts">
  import { getEnvironment, updateEnvironment } from "$lib/remotes/bot.remote";
  import parseDotenv from "$lib/utils/parseDotenv";
  import toaster from "$lib/utils/toaster";
  import { EnvironmentSchema, type EnvironmentVariables } from "@hallmaster/backend/schemas";
  import { EyeIcon, EyeOffIcon, FileUpIcon, PlusIcon, Trash2Icon } from "@lucide/svelte";
  import type { Attachment } from "svelte/attachments";
  import { slide } from "svelte/transition";

  const environment = getEnvironment();
  const form = updateEnvironment.preflight(EnvironmentSchema.partial());
  const fields = form.fields.variables;

  const initial = (await environment).variables;
  fields.set(initial);

  let ids = $state<string[]>(initial.map(() => crypto.randomUUID()));
  let shown = $state(false);
  let focused: string | undefined;
  let file: HTMLInputElement;

  const current = () => (fields.value() ?? []) as EnvironmentVariables;
  const serialize = (variables: EnvironmentVariables) =>
    JSON.stringify(
      variables.map(({ key, value }) => [key, value]).sort(([a], [b]) => a.localeCompare(b)),
    );

  let saved = $derived(serialize((await environment).variables));
  let changed = $derived(serialize(current()) !== saved);

  function load(variables: EnvironmentVariables) {
    const previous = current();

    ids = variables.map(
      ({ key }) =>
        ids[previous.findIndex((variable) => variable.key === key)] ?? crypto.randomUUID(),
    );
    fields.set(variables);
  }

  const focus: Attachment<HTMLInputElement> = (input) => {
    if (input.dataset.row === focused) input.focus();
  };

  function add() {
    focused = crypto.randomUUID();
    ids.push(focused);
    fields.set([...current(), { key: "", value: "" }]);
  }

  function remove(index: number) {
    ids.splice(index, 1);
    fields.set(current().toSpliced(index, 1));
  }

  function merge(imported: EnvironmentVariables) {
    if (imported.length === 0) {
      toaster.warning({ title: "No variable found", description: "Use one KEY=value per line" });
      return;
    }

    const kept = current().filter(({ key, value }) => key !== "" || value !== "");
    const merged = [
      ...kept.map((variable) => imported.find(({ key }) => key === variable.key) ?? variable),
      ...imported.filter(({ key }) => !kept.some((variable) => variable.key === key)),
    ];

    load(merged);
    void form.validate({ includeUntouched: true, preflightOnly: true });
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
</script>

<form
  {...form.enhance(({ submit }) => {
    toaster.promise(submit(), {
      loading: { title: "Saving environment.." },
      success: {
        title: "Environment saved",
        description: "Redeploy the clusters to apply it",
      },
      error: (error) => ({
        title: "Error",
        description: JSON.parse(error as string)?.message ?? "An error occurred",
      }),
    });
  })}
  class="flex flex-col gap-3"
  aria-labelledby="environment-title"
  oninput={() => form.validate({ preflightOnly: true })}
>
  <header class="flex items-start justify-between gap-4">
    <div class="flex flex-col gap-0.5">
      <h6 id="environment-title" class="h6 font-normal">Environment</h6>
      <p class="text-xs text-surface-700-300">
        Paste a whole .env into a name field to add its variables.
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

      <button type="button" class="btn preset-tonal btn-sm" onclick={() => file.click()}>
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

  {#if ids.length === 0}
    <p
      class="card border border-dashed border-surface-300-700 p-4 text-center text-sm text-surface-700-300"
    >
      No variables yet
    </p>
  {:else}
    <ul class="flex flex-col gap-2" aria-label="Environment variables">
      {#each ids as id, index (id)}
        {@const variable = fields[index]}
        {@const key = variable.key.value() || "the new variable"}
        {@const [issue] = variable.allIssues() ?? []}

        <li class="flex flex-col gap-1" in:slide={{ duration: 150 }}>
          <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
            <input
              {...variable.key.as("text")}
              class={["input font-mono text-sm", issue && "border-error-500"]}
              placeholder="NAME"
              aria-label="Name"
              autocomplete="off"
              spellcheck="false"
              data-row={id}
              onpaste={paste}
              {@attach focus}
            />
            <input
              {...variable.value.as(shown ? "text" : "password")}
              class="input font-mono text-sm"
              placeholder="value"
              aria-label={`Value of ${key}`}
              autocomplete="off"
              spellcheck="false"
            />
            <button
              type="button"
              class="btn-icon btn-icon-sm hover:preset-tonal-error"
              aria-label={`Remove ${key}`}
              onclick={() => remove(index)}
            >
              <Trash2Icon size={16} />
            </button>
          </div>

          {#if issue}
            <p class="ml-1 text-xs text-error-500" role="alert">{issue.message}</p>
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
        onclick={async () => load((await environment).variables)}
      >
        Reset
      </button>
      <button class="btn preset-filled-primary-500 btn-sm" disabled={!changed || !!form.pending}>
        Save
      </button>
    </div>
  </footer>
</form>
