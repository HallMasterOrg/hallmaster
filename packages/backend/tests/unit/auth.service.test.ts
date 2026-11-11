import { hash, verify as verifyHash } from "argon2";
import { verify as verifyToken } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "#lib/database";
import UserRepository from "#repositories/user.repository";
import { AuthService } from "#services/auth.service";

vi.mock("#lib/env", () => ({ default: { SECRET: "unit-secret", PORT: 3000 } }));

vi.mock("#lib/database", () => ({
  default: {
    user: {
      count: vi.fn(),
    },
  },
}));

vi.mock("#repositories/user.repository", () => ({
  default: {
    create: vi.fn(),
    findFirstByUsername: vi.fn(),
  },
}));

const credentials = { username: "admin", password: "password123" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(UserRepository.create).mockImplementation(({ username }) =>
    Promise.resolve({ username }),
  );
});

describe("registration", () => {
  it("creates the first account and returns a session token for it", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const { token } = await AuthService.register(credentials);

    expect(await verifyToken(token, "unit-secret", "HS256")).toMatchObject({ sub: "admin" });
  });

  it("stores a hash of the password, never the password itself", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    await AuthService.register(credentials);

    const [[{ passwordHash }]] = vi.mocked(UserRepository.create).mock.calls;
    expect(passwordHash).not.toBe(credentials.password);
    expect(await verifyHash(passwordHash, credentials.password)).toBe(true);
  });

  it("refuses a second account", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    await expect(AuthService.register(credentials)).rejects.toMatchObject({ status: 409 });
    expect(UserRepository.create).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  beforeEach(async () => {
    vi.mocked(UserRepository.findFirstByUsername).mockResolvedValue({
      username: "admin",
      passwordHash: await hash(credentials.password),
    });
  });

  it("returns a session token for the right password", async () => {
    const { token } = await AuthService.login(credentials);

    expect(await verifyToken(token, "unit-secret", "HS256")).toMatchObject({ sub: "admin" });
  });

  it("refuses a wrong password", async () => {
    await expect(
      AuthService.login({ username: "admin", password: "not-the-password" }),
    ).rejects.toMatchObject({ status: 401, message: "Invalid username or password" });
  });

  it("refuses an unknown user with the same message", async () => {
    vi.mocked(UserRepository.findFirstByUsername).mockResolvedValue(null);

    await expect(AuthService.login(credentials)).rejects.toMatchObject({
      status: 401,
      message: "Invalid username or password",
    });
  });
});
