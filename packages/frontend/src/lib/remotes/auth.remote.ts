import { form, getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { UserSchema, type UserTokenResponse } from "@hallmaster/backend/schemas";
import { error, invalid, redirect } from "@sveltejs/kit";

export const register = form(UserSchema, async (payload) => {
  const response = await fetch(new URL("/api/auth/register", env.API_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 201: {
      const { token } = (await response.json()) as UserTokenResponse;
      getRequestEvent().cookies.set("token", token, { path: "/" });

      return redirect(303, "/setup#bot");
    }
    case 400:
      return error(400, "Invalid fields");
    case 409:
      return error(409, "A user is already registered");

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const login = form(UserSchema, async (payload, issue) => {
  const response = await fetch(new URL("/api/auth/login", env.API_URL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 200: {
      const { token } = (await response.json()) as UserTokenResponse;
      getRequestEvent().cookies.set("token", token, { path: "/" });

      return redirect(303, "/clusters");
    }
    case 400:
      return error(400, "Invalid fields");
    case 401:
      return invalid(
        issue.username("Invalid email or password"),
        issue.password("Invalid email or password"),
      );

    default:
      console.error(await response.text());
      return error(500, "An error occurred");
  }
});

export const logout = form(async () => {
  getRequestEvent().cookies.delete("token", { path: "/" });
  redirect(303, "/login");
});
