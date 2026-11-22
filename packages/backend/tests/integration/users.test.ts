import { beforeEach, describe, expect, it } from "vitest";

import prisma from "#lib/database";

import {
  ADMIN,
  addAdmin,
  createBot,
  logInWithDiscord,
  OWNER,
  register,
  request,
  resetState,
} from "./helpers";

type User = { id: string; role: string };

let ownerToken: string;

async function logIn(user: typeof OWNER) {
  const response = await logInWithDiscord(user);

  return ((await response.json()) as { token: string }).token;
}

async function users(token = ownerToken) {
  const response = await request("/users", { token });

  return (await response.json()) as User[];
}

beforeEach(async () => {
  await resetState();
  ownerToken = await register();
  await createBot();
});

describe("admins", () => {
  it("lists the owner first", async () => {
    await addAdmin(ownerToken, ADMIN);

    expect((await users()).map(({ id, role }) => ({ id, role }))).toEqual([
      { id: OWNER.id, role: "OWNER" },
      { id: ADMIN.id, role: "ADMIN" },
    ]);
  });

  it("lets an added admin log in", async () => {
    const response = await addAdmin(ownerToken, ADMIN);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: ADMIN.id,
      username: ADMIN.username,
      displayName: ADMIN.global_name,
      role: "ADMIN",
    });
    expect((await logInWithDiscord(ADMIN)).status).toBe(200);
  });

  it("refuses an account that can already log in", async () => {
    await addAdmin(ownerToken, ADMIN);

    expect((await addAdmin(ownerToken, ADMIN)).status).toBe(409);
  });

  it("refuses a bot account", async () => {
    const response = await addAdmin(ownerToken, { ...ADMIN, bot: true });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "A bot cannot be an admin" });
  });

  it("refuses an invalid Discord ID", async () => {
    const response = await request("/users", {
      method: "POST",
      token: ownerToken,
      body: { id: "not-an-id" },
    });

    expect(response.status).toBe(400);
  });

  it("lets only the owner manage the admins", async () => {
    await addAdmin(ownerToken, ADMIN);
    const adminToken = await logIn(ADMIN);

    expect((await users(adminToken)).length).toBe(2);
    expect((await addAdmin(adminToken, { ...ADMIN, id: "333333333333333333" })).status).toBe(403);
    expect(
      (await request(`/users/${OWNER.id}/ownership`, { method: "POST", token: adminToken })).status,
    ).toBe(403);
  });

  it("ends the session of a removed admin", async () => {
    await addAdmin(ownerToken, ADMIN);
    const adminToken = await logIn(ADMIN);

    const response = await request(`/users/${ADMIN.id}`, { method: "DELETE", token: ownerToken });

    expect(response.status).toBe(204);
    expect((await request("/auth/me", { token: adminToken })).status).toBe(401);
    expect((await logInWithDiscord(ADMIN)).status).toBe(403);
  });

  it("keeps the owner", async () => {
    const response = await request(`/users/${OWNER.id}`, { method: "DELETE", token: ownerToken });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("ownership", () => {
  it("keeps a single owner when two transfers run at the same time", async () => {
    const other = { ...ADMIN, id: "333333333333333333", username: "other" };
    await addAdmin(ownerToken, ADMIN);
    await addAdmin(ownerToken, other);

    const statuses = await Promise.all(
      [ADMIN, other].map(async ({ id }) => {
        const response = await request(`/users/${id}/ownership`, {
          method: "POST",
          token: ownerToken,
        });

        return response.status;
      }),
    );

    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: "OWNER" } })).toBe(1);
  });

  it("lets the database refuse a second owner", async () => {
    await expect(
      prisma.user.create({ data: { id: ADMIN.id, username: ADMIN.username, role: "OWNER" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("makes the admin the owner and the owner an admin", async () => {
    await addAdmin(ownerToken, ADMIN);

    const response = await request(`/users/${ADMIN.id}/ownership`, {
      method: "POST",
      token: ownerToken,
    });

    expect(response.status).toBe(200);
    expect(((await response.json()) as User[]).map(({ id, role }) => ({ id, role }))).toEqual([
      { id: ADMIN.id, role: "OWNER" },
      { id: OWNER.id, role: "ADMIN" },
    ]);
    expect((await addAdmin(ownerToken, { ...ADMIN, id: "333333333333333333" })).status).toBe(403);
  });

  it("reports an unknown user", async () => {
    const response = await request("/users/333333333333333333/ownership", {
      method: "POST",
      token: ownerToken,
    });

    expect(response.status).toBe(404);
  });
});
