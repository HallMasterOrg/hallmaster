import { beforeEach, describe, expect, it, vi } from "vitest";

import BotRepository from "#repositories/bot.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import UserRepository from "#repositories/user.repository";
import StatusService from "#services/status.service";

vi.mock("#repositories/user.repository", () => ({ default: { count: vi.fn() } }));
vi.mock("#repositories/bot.repository", () => ({ default: { count: vi.fn() } }));
vi.mock("#repositories/container-image.repository", () => ({ default: { count: vi.fn() } }));

function given(users: number, bots: number, containerImages: number) {
  vi.mocked(UserRepository.count).mockResolvedValue(users);
  vi.mocked(BotRepository.count).mockResolvedValue(bots);
  vi.mocked(ContainerImageRepository.count).mockResolvedValue(containerImages);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("onboarding status", () => {
  it.each([
    ["a new instance", [0, 0, 0], { hasUser: false, hasBot: false }],
    ["an account without bot", [1, 0, 0], { hasUser: true, hasBot: false }],
    ["a bot without container image", [1, 1, 0], { hasUser: true, hasBot: false }],
    ["a bot and its container image", [1, 1, 1], { hasUser: true, hasBot: true }],
  ] as const)("reports %s", async (_case, [users, bots, containerImages], expected) => {
    given(users, bots, containerImages);

    expect(await StatusService.get()).toEqual(expected);
  });
});
