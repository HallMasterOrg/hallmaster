import { goto } from "$app/navigation";
import { isHttpError } from "@sveltejs/kit";

export default function handleLiveError(error: unknown) {
  if (isHttpError(error, 401)) {
    void goto("/login");
    return;
  }

  throw error;
}
