<script lang="ts">
import { BracesIcon, ContainerIcon } from "@lucide/svelte";
</script>

<div class="flex flex-col gap-4">
	<label class="label">
		<div class="ml-1 flex items-center gap-1">
			<ContainerIcon size={16} />
			<span class="label-text">Container image url</span>
		</div>

		<div class="input-group grid-cols-[auto_1fr_auto]">
			<div class="ig-cell">https://</div>
			<input class="ig-input" type="url" placeholder="ghcr.io/image:tag" disabled />
		</div>
	</label>

	<label class="label">
		<div class="ml-1 flex items-center gap-1">
			<BracesIcon size={16} />
			<span class="label-text">Bot token</span>
		</div>

		<input class="input" type="url" placeholder="8f0a2f30b4e738362ee19e8e572edb8a" disabled />
	</label>
</div>
