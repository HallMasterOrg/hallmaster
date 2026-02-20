import { CreateBotSchema } from "@hallmaster/backend/dto";
import { redirect } from "@sveltejs/kit";
import { form } from "$app/server";

export const createBot = form(CreateBotSchema, async () => {
  redirect(303, "/");
});
