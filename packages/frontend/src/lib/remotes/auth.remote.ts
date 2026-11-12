import { form, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import type { User } from "@hallmaster/backend/schemas";
import { error, redirect } from "@sveltejs/kit";

export const getUser = query<User>(async () => {
  const response = await fetch(new URL("/api/auth/me", env.API_URL), {
    headers: { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` },
  });

  switch (response.status) {
    case 200:
      return response.json();
    case 401:
      return redirect(303, "/login");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const logout = form(async () => {
  getRequestEvent().cookies.delete("token", { path: "/" });
  redirect(303, "/login");
});
