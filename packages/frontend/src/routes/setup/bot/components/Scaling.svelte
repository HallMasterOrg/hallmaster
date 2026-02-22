<script>
import { BoxesIcon, BoxIcon } from "@lucide/svelte";
import { Switch } from "@skeletonlabs/skeleton-svelte";
import LabeledInput from "$lib/components/LabeledInput.svelte";
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
    <LabeledInput
      label="Clusters"
      icon={BoxesIcon}
      disabled={checked}
      required
      min={1}
      {...createBot.fields.clusters.as("number")}
      issues={createBot.fields.clusters.issues()}
    />

    <LabeledInput
      label="Shards"
      icon={BoxIcon}
      disabled={checked}
      required
      min={1}
      {...createBot.fields.shards.as("number")}
      issues={createBot.fields.shards.issues()}
    />
	</div>
</div>
