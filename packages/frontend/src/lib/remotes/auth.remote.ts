import { form, getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { loginSchema, registerSchema } from "@hallmaster/backend/dto";
import { error, invalid, redirect } from "@sveltejs/kit";

export const register = form(registerSchema, async (payload) => {
  const response = await fetch(`${env.API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 201: {
      const { cookies } = getRequestEvent();
      const { token } = await response.json();

      cookies.set("token", token, { path: "/" });
      return redirect(303, "/setup#bot");
    }
    case 400:
      return error(400, "Invalid fields");
    case 409:
      return error(409, "A user is already registered");

    default:
      return error(500, "An error occurred");
  }
});

export const login = form(loginSchema, async (payload, issue) => {
  const response = await fetch(`${env.API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  switch (response.status) {
    case 200: {
      const { cookies } = getRequestEvent();
      const { token } = await response.json();

      cookies.set("token", token, { path: "/" });
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
      return error(500, "An error occurred");
  }
});
