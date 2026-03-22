import { command, getRequestEvent, query } from "$app/server";
import { API_URL } from "$env/static/private";
import type { GetClusterDto } from "@hallmaster/backend/dto";
import { error } from "@sveltejs/kit";

export const getClusters = query(async (): Promise<GetClusterDto[]> => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${API_URL}/clusters`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 200:
      return await response.json();
    case 401:
      return error(401, "Unauthorized");

    default:
      return error(500, "An error occured");
  }
});

export const startCluster = command("unchecked", async (id: string) => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${API_URL}/clusters/${id}/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 204:
      return;
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Cluster not found");

    default:
      return error(500, "An error occured");
  }
});

export const stopCluster = command("unchecked", async (id: string) => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${API_URL}/clusters/${id}/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 204:
      return;
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Cluster not found");

    default:
      return error(500, "An error occured");
  }
});

export const restartCluster = command("unchecked", async (id: string) => {
  const token = getRequestEvent().cookies.get("token");

  const response = await fetch(`${API_URL}/clusters/${id}/restart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  switch (response.status) {
    case 204:
      return;
    case 401:
      return error(401, "Unauthorized");
    case 404:
      return error(404, "Cluster not found");

    default:
      return error(500, "An error occured");
  }
});
