import { command, form, getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";
import {
  AddUserSchema,
  UserIdSchema,
  type ApiError,
  type User,
  type Users,
} from "@hallmaster/backend/schemas";
import { error, redirect } from "@sveltejs/kit";

import { getUser } from "./auth.remote";

function authorization() {
  return { Authorization: `Bearer ${getRequestEvent().cookies.get("token")}` };
}

async function failed(response: Response) {
  switch (response.status) {
    case 400:
    case 403:
    case 404:
    case 409:
    case 424:
      return error(response.status, ((await response.json()) as ApiError).message);
    case 401:
      return redirect(303, "/login");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
}

export const getUsers = query<Users>(async () => {
  const response = await fetch(new URL("/api/users", env.API_URL), { headers: authorization() });

  return response.ok ? ((await response.json()) as Users) : await failed(response);
});

export const addAdmin = form(AddUserSchema, async (payload) => {
  const response = await fetch(new URL("/api/users", env.API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorization() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) return await failed(response);

  const admin = (await response.json()) as User;
  await getUsers().refresh();

  return admin;
});

export const removeAdmin = command(UserIdSchema, async (id) => {
  const response = await fetch(new URL(`/api/users/${id}`, env.API_URL), {
    method: "DELETE",
    headers: authorization(),
  });

  if (!response.ok) return await failed(response);

  await getUsers().refresh();
});

export const transferOwnership = command(UserIdSchema, async (id) => {
  const response = await fetch(new URL(`/api/users/${id}/ownership`, env.API_URL), {
    method: "POST",
    headers: authorization(),
  });

  if (!response.ok) return await failed(response);

  getUsers().set((await response.json()) as Users);
  await getUser().refresh();
});
