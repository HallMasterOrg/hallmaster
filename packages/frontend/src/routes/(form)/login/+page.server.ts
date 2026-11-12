import { getStatus } from "$lib/server/status";
import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const { hasUser } = await getStatus();

  if (!hasUser) {
    redirect(303, `/setup${url.search}`);
  }
};
