import { CreateBotSchema } from "@hallmaster/backend/dto";
import { error, redirect } from "@sveltejs/kit";
import { form, getRequestEvent } from "$app/server";
import { API_URL } from "$env/static/private";

export const createBot = form(CreateBotSchema, async (data) => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${API_URL}/bot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  switch (response.status) {
    case 201:
      return redirect(303, "/");
    case 401:
      return error(401, "Unauthorized");
    case 409:
      return error(409, "A bot already exists");
    default:
      return error(500, "An error occured");
  }
});
