import { getStatus, hasSession } from "$lib/server/status";
import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  const { hasUser, hasBot } = await getStatus();

  if (!hasUser) {
    return { step: "account" as const };
  }

  if (hasBot) {
    redirect(303, "/clusters");
  }

  // Registering the bot needs the session of the account created at the first step
  if (!(await hasSession(cookies.get("token")))) {
    redirect(303, "/login");
  }

  return { step: "bot" as const };
};
