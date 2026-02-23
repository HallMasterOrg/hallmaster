<script lang="ts">
import { BracesIcon, ContainerIcon } from "@lucide/svelte";
import LabeledInput from "$lib/components/LabeledInput.svelte";
</script>

<div class="flex flex-col gap-4">
  <LabeledInput
    label="Container image url"
    icon={ContainerIcon}
    type="url"
    placeholder="https://ghcr.io/image:tag"
    disabled
  />

  <LabeledInput
    label="Bot token"
    icon={BracesIcon}
    type="password"
    placeholder="8f0a2f30b4e738362ee19e8e572edb8a"
    disabled
  />
</div>
