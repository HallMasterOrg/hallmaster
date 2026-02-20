<script lang="ts">
import {
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudUploadIcon,
  PackageIcon,
  ScalingIcon,
} from "@lucide/svelte";
import { Steps } from "@skeletonlabs/skeleton-svelte";

import { createBot } from "$lib/remotes/bot.remote";
import Deployment from "./components/Deployment.svelte";
import Scaling from "./components/Scaling.svelte";

let step = $state(0);
const steps = [
  { title: "Deployment", icon: PackageIcon, content: Deployment },
  { title: "Scaling", icon: ScalingIcon, content: Scaling },
];
</script>

<main class="absolute top-1/2 left-1/2 -translate-1/2">
	<form
		{...createBot}
		class="flex flex-col items-center gap-4 card preset-filled-surface-100-900 p-6"
	>
		<BotIcon size={64} />

		<Steps
			count={steps.length}
			onStepChange={(details) => (step = details.step)}
		>
			<Steps.List>
				{#each steps as item, index}
					{@const Icon = item.icon}
					<Steps.Item {index}>
						<Steps.Trigger>
							<Steps.Indicator>
								<Icon size={16} />
							</Steps.Indicator>
							<span>{item.title}</span>
						</Steps.Trigger>
						{#if index < steps.length - 1}
							<Steps.Separator />
						{/if}
					</Steps.Item>
				{/each}
			</Steps.List>

			{#each steps as item, index}
				{@const Content = item.content}
				<Steps.Content {index}>
					<Content />
				</Steps.Content>
			{/each}

			<div class="flex items-center gap-2">
				<Steps.PrevTrigger class="btn-icon preset-tonal">
					<ChevronLeftIcon />
				</Steps.PrevTrigger>
				{#if step != steps.length - 1}
					<Steps.NextTrigger class="flex-1 btn preset-tonal">
						<span>Next</span>
						<ChevronRightIcon />
					</Steps.NextTrigger>
				{:else}
					<button type="submit" class="flex-1 btn preset-filled-primary-500">
						<span>Submit</span>
						<CloudUploadIcon />
					</button>
				{/if}
			</div>
		</Steps>
	</form>
</main>
