import { form, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";

export const logout = form(async () => {
  getRequestEvent().cookies.delete("token", { path: "/" });
  redirect(303, "/login");
});
