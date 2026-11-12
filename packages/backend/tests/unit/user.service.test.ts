import { beforeEach, describe, expect, it, vi } from "vitest";

import BotRepository from "#repositories/bot.repository";
import UserRepository from "#repositories/user.repository";
import DiscordService from "#services/discord.service";
import UserService from "#services/user.service";

vi.mock("#repositories/user.repository", () => ({
  default: {
    create: vi.fn(),
    deleteAdminById: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    transferOwnership: vi.fn(),
  },
}));

vi.mock("#repositories/bot.repository", () => ({
  default: { findFirstIdAndToken: vi.fn() },
}));

vi.mock("#services/discord.service", () => ({
  default: {
    avatarUrl: vi.fn(),
    getUserById: vi.fn(),
  },
}));

const createdAt = new Date("2026-11-12T10:00:00.000Z");
const owner = {
  id: "111111111111111111",
  username: "owner",
  displayName: "Owner",
  avatar: "avatar",
  role: "OWNER" as const,
  createdAt,
};
const admin = {
  id: "222222222222222222",
  username: "admin",
  displayName: null,
  avatar: null,
  role: "ADMIN" as const,
  createdAt,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(BotRepository.findFirstIdAndToken).mockResolvedValue({ id: "bot", token: "token" });
  vi.mocked(UserRepository.findMany).mockResolvedValue([owner, admin]);
});

describe("users", () => {
  it("returns the Discord profile and role of each user", async () => {
    vi.mocked(DiscordService.avatarUrl).mockImplementation((id, hash) =>
      hash === null ? null : `https://cdn.discordapp.com/avatars/${id}/${hash}.png`,
    );

    expect(await UserService.getAll()).toEqual([
      {
        id: owner.id,
        username: "owner",
        displayName: "Owner",
        avatarUrl: `https://cdn.discordapp.com/avatars/${owner.id}/avatar.png`,
        role: "OWNER",
        createdAt: "2026-11-12T10:00:00.000Z",
      },
      {
        id: admin.id,
        username: "admin",
        displayName: null,
        avatarUrl: null,
        role: "ADMIN",
        createdAt: "2026-11-12T10:00:00.000Z",
      },
    ]);
  });
});

describe("add an admin", () => {
  it("saves the Discord profile found with the bot token", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(DiscordService.getUserById).mockResolvedValue({
      id: admin.id,
      username: "admin",
      global_name: null,
      discriminator: "0",
      avatar: null,
    });
    vi.mocked(UserRepository.create).mockResolvedValue(admin);

    expect(await UserService.addAdmin(admin.id)).toMatchObject({ id: admin.id, role: "ADMIN" });
    expect(DiscordService.getUserById).toHaveBeenCalledWith("token", admin.id);
    expect(UserRepository.create).toHaveBeenCalledWith({
      id: admin.id,
      username: "admin",
      displayName: null,
      avatar: null,
      role: "ADMIN",
    });
  });

  it("refuses an account that can already log in", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(admin);

    await expect(UserService.addAdmin(admin.id)).rejects.toMatchObject({ status: 409 });
    expect(DiscordService.getUserById).not.toHaveBeenCalled();
  });

  it("needs the bot to look the user up", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(BotRepository.findFirstIdAndToken).mockResolvedValue(null);

    await expect(UserService.addAdmin(admin.id)).rejects.toMatchObject({
      status: 409,
      message: "Register the bot before adding admins",
    });
  });

  it("refuses a bot account", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);
    vi.mocked(DiscordService.getUserById).mockResolvedValue({
      id: admin.id,
      username: "other-bot",
      global_name: null,
      discriminator: "0",
      avatar: null,
      bot: true,
    });

    await expect(UserService.addAdmin(admin.id)).rejects.toMatchObject({
      status: 400,
      message: "A bot cannot be an admin",
    });
    expect(UserRepository.create).not.toHaveBeenCalled();
  });
});

describe("remove an admin", () => {
  it("deletes the admin", async () => {
    vi.mocked(UserRepository.deleteAdminById).mockResolvedValue(true);

    await UserService.removeAdmin(admin.id);

    expect(UserRepository.deleteAdminById).toHaveBeenCalledWith(admin.id);
  });

  it("keeps the owner", async () => {
    vi.mocked(UserRepository.deleteAdminById).mockResolvedValue(false);
    vi.mocked(UserRepository.findById).mockResolvedValue(owner);

    await expect(UserService.removeAdmin(owner.id)).rejects.toMatchObject({
      status: 400,
      message: "The owner cannot be removed",
    });
  });

  it("reports an unknown user", async () => {
    vi.mocked(UserRepository.deleteAdminById).mockResolvedValue(false);
    vi.mocked(UserRepository.findById).mockResolvedValue(null);

    await expect(UserService.removeAdmin(admin.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("transfer the ownership", () => {
  it("swaps the roles of the owner and the admin", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(admin);
    vi.mocked(UserRepository.transferOwnership).mockResolvedValue(true);

    await UserService.transferOwnership(owner, admin.id);

    expect(UserRepository.transferOwnership).toHaveBeenCalledWith(owner.id, admin.id);
  });

  it("refuses an owner who already handed the instance over", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(admin);
    vi.mocked(UserRepository.transferOwnership).mockResolvedValue(false);

    await expect(UserService.transferOwnership(owner, admin.id)).rejects.toMatchObject({
      status: 409,
      message: "You are no longer the owner",
    });
  });

  it("refuses to transfer it to the owner", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(owner);

    await expect(UserService.transferOwnership(owner, owner.id)).rejects.toMatchObject({
      status: 400,
    });
    expect(UserRepository.transferOwnership).not.toHaveBeenCalled();
  });

  it("reports an unknown user", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(null);

    await expect(UserService.transferOwnership(owner, admin.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
