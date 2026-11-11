import { beforeEach, describe, expect, it } from "vitest";

import { register, request, resetState } from "./helpers";

beforeEach(async () => {
  await resetState();
});

describe("authentication", () => {
  it("registers a single user", async () => {
    expect(await register()).toEqual(expect.any(String));

    const second = await request("/auth/register", {
      method: "POST",
      body: { username: "other", password: "password123" },
    });

    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ message: "A user is already registered" });
  });

  it("rejects a wrong password", async () => {
    await register();

    const response = await request("/auth/login", {
      method: "POST",
      body: { username: "admin", password: "wrong-password" },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Invalid username or password" });
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
    const response = await request("/auth/register", {
      method: "POST",
      body: { username: "admin", password: "short" },
    });
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(JSON.parse(body)).toEqual({
      message: "Validation failed",
      issues: [{ path: "password", message: expect.any(String) }],
    });
    expect(body).not.toContain("short");
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
