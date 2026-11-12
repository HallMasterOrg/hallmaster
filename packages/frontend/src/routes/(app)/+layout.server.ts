import { getStatus, hasSession } from "$lib/server/status";
import { redirect } from "@sveltejs/kit";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
  const { hasBot } = await getStatus();

  if (!hasBot) {
    redirect(303, "/setup");
  }

  if (!(await hasSession(cookies.get("token")))) {
    redirect(303, "/login");
  }
};
