<script>
import { BoxesIcon, BoxIcon } from "@lucide/svelte";
import { Switch } from "@skeletonlabs/skeleton-svelte";
import { createBot } from "$lib/remotes/bot.remote";

let checked = $state(false);
</script>

<div class="flex flex-col gap-4">
	<Switch {checked} onCheckedChange={(details) => (checked = details.checked)} disabled>
		<Switch.Control>
			<Switch.Thumb />
		</Switch.Control>
		<Switch.Label>Automatic scaling</Switch.Label>
		<Switch.HiddenInput />
	</Switch>

	<div class="flex gap-2">
		<label class="label">
			<div class="ml-1 flex items-center gap-1">
				<BoxesIcon size={16} />
				<span class="label-text">Clusters*</span>
			</div>

			<input class="input" disabled={checked} min="1" required {...createBot.fields.clusters.as("number")} />
			{#each createBot.fields.clusters.issues() as issue}
				<p class="text-error-200-800">{issue.message}</p>
			{/each}
		</label>

		<label class="label">
			<div class="ml-1 flex items-center gap-1">
				<BoxIcon size={16} />
				<span class="label-text">Shards*</span>
			</div>

			<input class="input" disabled={checked} min="1" required {...createBot.fields.shards.as("number")} />
			{#each createBot.fields.shards.issues() as issue}
				<p class="text-error-200-800">{issue.message}</p>
			{/each}
		</label>
	</div>
</div>
