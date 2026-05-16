import { redirect, type HandleClientError } from "@sveltejs/kit";

export const handleError: HandleClientError = async ({ status }) => {
  switch (status) {
    case 404:
      return redirect(303, "/clusters");

    default:
      break;
  }
};
