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
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("#services/discord.service", () => ({
  default: {
    authorizationUrl: vi.fn(),
    avatarUrl: vi.fn(),
    getAccessToken: vi.fn(),
    getUser: vi.fn(),
  },
}));

const owner = {
  id: "111111111111111111",
  username: "owner",
  displayName: "Owner",
  avatar: "avatar",
};
const login = { code: "code", redirectUri: "http://localhost/login/discord/callback" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(DiscordService.getAccessToken).mockResolvedValue("access-token");
  vi.mocked(DiscordService.getUser).mockResolvedValue({
    id: owner.id,
    username: owner.username,
    global_name: owner.displayName,
    discriminator: "0",
    avatar: owner.avatar,
  });
  vi.mocked(UserRepository.create).mockImplementation((user) => Promise.resolve(user));
  vi.mocked(UserRepository.update).mockImplementation((user) => Promise.resolve(user));
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

  it("creates the account of the first Discord user", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(UserRepository.count).mockResolvedValue(0);

    const { token } = await AuthService.login(login);

    expect(UserRepository.create).toHaveBeenCalledWith(owner);
    expect(await verify(token, "unit-secret", "HS256")).toMatchObject({ sub: owner.id });
  });

  it("logs the account back in with its current Discord profile", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue({ ...owner, avatar: null });

    const { token } = await AuthService.login(login);

    expect(UserRepository.create).not.toHaveBeenCalled();
    expect(UserRepository.update).toHaveBeenCalledWith(owner);
    expect(await verify(token, "unit-secret", "HS256")).toMatchObject({ sub: owner.id });
  });

  it("refuses another Discord account once the account exists", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(UserRepository.count).mockResolvedValue(1);

    await expect(AuthService.login(login)).rejects.toMatchObject({
      status: 403,
      message: "This Discord account cannot access this instance",
    });
    expect(UserRepository.create).not.toHaveBeenCalled();
  });

  it("refuses a code Discord does not accept", async () => {
    vi.mocked(DiscordService.getAccessToken).mockRejectedValue(
      new UnauthorizedException({ message: "Invalid Discord authorization code" }),
    );

    await expect(AuthService.login(login)).rejects.toMatchObject({ status: 401 });
    expect(DiscordService.getUser).not.toHaveBeenCalled();
  });
});

describe("me", () => {
  it("returns the Discord profile of the user", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(owner);
    vi.mocked(DiscordService.avatarUrl).mockReturnValue("https://cdn.discordapp.com/avatar.png");

    expect(await AuthService.me(owner.id)).toEqual({
      id: owner.id,
      username: "owner",
      displayName: "Owner",
      avatarUrl: "https://cdn.discordapp.com/avatar.png",
    });
    expect(DiscordService.avatarUrl).toHaveBeenCalledWith(owner.id, "avatar");
  });

  it("refuses a session whose account no longer exists", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);

    await expect(AuthService.me(owner.id)).rejects.toMatchObject({ status: 401 });
  });
});
