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
  },
}));

vi.mock("#services/discord.service", () => ({
  default: {
    authorizationUrl: vi.fn(),
    getAccessToken: vi.fn(),
    getUser: vi.fn(),
  },
}));

const owner = { id: "111111111111111111", username: "owner" };
const login = { code: "code", redirectUri: "http://localhost/login/discord/callback" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(DiscordService.getAccessToken).mockResolvedValue("access-token");
  vi.mocked(DiscordService.getUser).mockResolvedValue({
    ...owner,
    global_name: "Owner",
    discriminator: "0",
    avatar: null,
  });
  vi.mocked(UserRepository.create).mockImplementation((user) => Promise.resolve(user));
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

  it("logs the account back in", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(owner);

    const { token } = await AuthService.login(login);

    expect(UserRepository.create).not.toHaveBeenCalled();
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
