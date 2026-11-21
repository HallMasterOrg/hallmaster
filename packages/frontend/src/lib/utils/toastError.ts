import { goto } from "$app/navigation";
import { isHttpError } from "@sveltejs/kit";

export default function toastError(error: unknown) {
  if (isHttpError(error, 401)) {
    void goto("/login");
  }

  return {
    title: "Error",
    description: isHttpError(error) ? error.body.message : "An error occurred",
  };
}
