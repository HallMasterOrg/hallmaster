import { createToaster } from "@skeletonlabs/skeleton-svelte";

const toaster = createToaster({
  placement: "bottom-end",
  overlap: true,
});
export default toaster;
