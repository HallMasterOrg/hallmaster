import { createToaster } from "@skeletonlabs/skeleton-svelte";

const toaster = createToaster({
  placement: "bottom-end",
  overlap: true,
  duration: 5000,
});
export default toaster;
