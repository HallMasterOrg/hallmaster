import { verify } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedException } from "#exceptions/http-exceptions";
import UserRepository from "#repositories/user.repository";
import { AuthService } from "#services/auth.service";
import DiscordService from "#services/discord.service";

vi.mock("#lib/env", () => ({ default: { SECRET: "unit-secret", PORT: 3000 } }));

vi.mock("#repositories/user.repository", () => ({
  default: {
    count: vi.fn(),
    createOwner: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("#services/discord.service", () => ({
  default: {
    authorizationUrl: vi.fn(),
    getAccessToken: vi.fn(),
    getUser: vi.fn(),
  },
}));

const profile = {
  id: "111111111111111111",
  username: "owner",
  displayName: "Owner",
  avatar: "avatar",
};
const owner = { ...profile, role: "OWNER" as const, createdAt: new Date() };
const login = { code: "code", redirectUri: "http://localhost/login/discord/callback" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(DiscordService.getAccessToken).mockResolvedValue("access-token");
  vi.mocked(DiscordService.getUser).mockResolvedValue({
    id: profile.id,
    username: profile.username,
    global_name: profile.displayName,
    discriminator: "0",
    avatar: profile.avatar,
  });
  vi.mocked(UserRepository.createOwner).mockResolvedValue(owner);
  vi.mocked(UserRepository.update).mockResolvedValue(owner);
});

describe("authorization url", () => {
  it("asks Discord for the page of the instance", () => {
    vi.mocked(DiscordService.authorizationUrl).mockReturnValue(
      "https://discord.com/oauth2/authorize",
    );

    expect(
      AuthService.authorizationUrl({ redirectUri: login.redirectUri, state: "state" }),
    ).toEqual({
      url: "https://discord.com/oauth2/authorize",
    });
    expect(DiscordService.authorizationUrl).toHaveBeenCalledWith(login.redirectUri, "state");
  });
});

describe("login", () => {
  it("exchanges the code sent to the redirect uri", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(owner);

    await AuthService.login(login);

    expect(DiscordService.getAccessToken).toHaveBeenCalledWith("code", login.redirectUri);
    expect(DiscordService.getUser).toHaveBeenCalledWith("access-token");
  });

  it("makes the first Discord user the owner", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(UserRepository.count).mockResolvedValue(0);

    const { token } = await AuthService.login(login);

    expect(UserRepository.createOwner).toHaveBeenCalledWith(profile);
    expect(await verify(token, "unit-secret", "HS256")).toMatchObject({ sub: owner.id });
  });

  it("logs the account back in with its current Discord profile", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue({ ...owner, avatar: null });

    const { token } = await AuthService.login(login);

    expect(UserRepository.createOwner).not.toHaveBeenCalled();
    expect(UserRepository.update).toHaveBeenCalledWith(profile);
    expect(await verify(token, "unit-secret", "HS256")).toMatchObject({ sub: owner.id });
  });

  it("refuses a Discord account that was not added as an admin", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(UserRepository.count).mockResolvedValue(1);

    await expect(AuthService.login(login)).rejects.toMatchObject({
      status: 403,
      message: "This Discord account cannot access this instance",
    });
    expect(UserRepository.createOwner).not.toHaveBeenCalled();
  });

  it("refuses the second of two first logins at the same time", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(UserRepository.count).mockResolvedValue(0);
    vi.mocked(UserRepository.createOwner).mockResolvedValue(null);

    await expect(AuthService.login(login)).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a code Discord does not accept", async () => {
    vi.mocked(DiscordService.getAccessToken).mockRejectedValue(
      new UnauthorizedException({ message: "Invalid Discord authorization code" }),
    );

    await expect(AuthService.login(login)).rejects.toMatchObject({ status: 401 });
    expect(DiscordService.getUser).not.toHaveBeenCalled();
  });
});
