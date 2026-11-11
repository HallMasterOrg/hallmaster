import { getStatus } from "$lib/server/status";
import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const { hasUser } = await getStatus();

  // Nobody can log in to a new instance: its account is created on the setup page
  if (!hasUser) {
    redirect(303, "/setup");
  }
};
