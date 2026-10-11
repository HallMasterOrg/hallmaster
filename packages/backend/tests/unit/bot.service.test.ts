import { beforeEach, describe, expect, it, vi } from "vitest";

import ContainerImageRepository from "#repositories/container-image.repository";
import BotService from "#services/bot.service";
import DockerService from "#services/docker.service";

vi.mock("#repositories/bot.repository", () => ({ default: {} }));
vi.mock("#repositories/cluster.repository", () => ({ default: {} }));

vi.mock("#repositories/container-image.repository", () => ({
  default: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("#services/docker.service", () => ({
  default: {
    ensureImage: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ContainerImageRepository.create).mockImplementation((data) => Promise.resolve(data));
  vi.mocked(ContainerImageRepository.update).mockImplementation((data) => Promise.resolve(data));
});

describe("container image registration", () => {
  it.each([
    ["alpine", "docker.io", "library/alpine", "latest"],
    ["hallmaster-bot:dev", "docker.io", "library/hallmaster-bot", "dev"],
    ["user/app:1.0", "docker.io", "user/app", "1.0"],
    ["ghcr.io/org/app:2", "ghcr.io", "org/app", "2"],
    ["localhost:5000/app", "localhost:5000", "app", "latest"],
    ["localhost/app:edge", "localhost", "app", "edge"],
  ])("normalizes %s", async (url, serverName, image, tag) => {
    const registered = await BotService.createContainerImage({ url });

    expect(registered.url).toBe(`${serverName}/${image}:${tag}`);
    expect(DockerService.ensureImage).toHaveBeenCalledWith(
      expect.objectContaining({ serverName, image, tag }),
    );
  });
});

describe("container image update", () => {
  beforeEach(() => {
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue({
      serverName: "registry.example.com",
      image: "bot",
      tag: "1.0",
      username: "deployer",
      password: "secret",
    });
  });

  it("keeps the password on the same registry and user", async () => {
    await BotService.updateContainerImage({
      url: "registry.example.com/bot:2.0",
      username: "deployer",
    });

    expect(DockerService.ensureImage).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "2.0", username: "deployer", password: "secret" }),
    );
    expect(ContainerImageRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ username: "deployer", password: "secret" }),
    );
  });

  it("uses the new password when one is provided", async () => {
    await BotService.updateContainerImage({
      url: "registry.example.com/bot:2.0",
      username: "deployer",
      password: "rotated",
    });

    expect(ContainerImageRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ password: "rotated" }),
    );
  });

  it.each([
    ["another user", { url: "registry.example.com/bot:2.0", username: "someone" }, "someone"],
    ["another registry", { url: "ghcr.io/org/bot:2.0", username: "deployer" }, "deployer"],
    ["no user", { url: "registry.example.com/bot:2.0" }, null],
  ])("drops the password for %s", async (_case, image, username) => {
    await BotService.updateContainerImage(image);

    expect(ContainerImageRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ username, password: null }),
    );
  });

  it("rejects the update when no image is registered", async () => {
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue(null);

    await expect(BotService.updateContainerImage({ url: "alpine" })).rejects.toMatchObject({
      status: 404,
    });
    expect(DockerService.ensureImage).not.toHaveBeenCalled();
  });
});
