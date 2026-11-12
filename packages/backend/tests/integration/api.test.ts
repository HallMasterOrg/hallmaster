import { beforeEach, describe, expect, it } from "vitest";

import prisma from "#lib/database";

import { logInWithDiscord, OWNER, REDIRECT_URI, register, request, resetState } from "./helpers";

beforeEach(async () => {
  await resetState();
});

describe("authentication", () => {
  it("sends the user to the Discord authorization page", async () => {
    const query = new URLSearchParams({ redirectUri: REDIRECT_URI, state: "state" });
    const response = await request(`/auth/discord?${query}`);
    const { url } = (await response.json()) as { url: string };

    expect(response.status).toBe(200);
    expect(new URL(url).searchParams.get("client_id")).toBe("integration-client");
    expect(new URL(url).searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
  });

  it("creates the account of the first Discord user and logs it back in", async () => {
    const first = await logInWithDiscord(OWNER);
    const second = await logInWithDiscord({ ...OWNER, global_name: "Renamed", avatar: "a_new" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await prisma.user.findMany()).toEqual([
      {
        id: OWNER.id,
        username: OWNER.username,
        displayName: "Renamed",
        avatar: "a_new",
        role: "OWNER",
        createdAt: expect.any(Date),
      },
    ]);
  });

  it("returns the Discord profile of the logged in user", async () => {
    const token = await register();

    const response = await request("/auth/me", { token });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: OWNER.id,
      username: OWNER.username,
      displayName: OWNER.global_name,
      avatarUrl: null,
      role: "OWNER",
      createdAt: expect.any(String),
    });
  });

  it("refuses the session of an account that no longer exists", async () => {
    const token = await register();
    await prisma.user.deleteMany();

    const response = await request("/auth/me", { token });

    expect(response.status).toBe(401);
  });

  it("refuses another Discord account", async () => {
    await register();

    const response = await logInWithDiscord({ ...OWNER, id: "222222222222222222" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: "This Discord account cannot access this instance",
    });
  });

  it("rejects a request without a token", async () => {
    const response = await request("/clusters");

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(await response.json()).toEqual({ message: expect.any(String) });
  });
});

describe("error responses", () => {
  it("lists invalid fields without echoing the submitted values", async () => {
    const response = await request("/auth/discord", {
      method: "POST",
      body: { code: "code", redirectUri: "not-an-uri" },
    });
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(JSON.parse(body)).toEqual({
      message: "Validation failed",
      issues: [{ path: "redirectUri", message: expect.any(String) }],
    });
    expect(body).not.toContain("not-an-uri");
  });

  it("reports invalid path parameters", async () => {
    const token = await register();

    const response = await request("/clusters/abc", { token });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ issues: [{ path: "id" }] });
  });

  it("reports unknown routes as json", async () => {
    const response = await request("/nope");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Route not found" });
  });

  it("reports unknown clusters as json", async () => {
    const token = await register();

    const response = await request("/clusters/42", { token });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Cluster 42 not found" });
  });
});
