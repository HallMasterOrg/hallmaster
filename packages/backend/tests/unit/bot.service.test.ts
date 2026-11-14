import { beforeEach, describe, expect, it, vi } from "vitest";

import BotRepository from "#repositories/bot.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import EnvironmentVariableRepository from "#repositories/environment-variable.repository";
import BotService from "#services/bot.service";
import ClusterService from "#services/cluster.service";
import DiscordService from "#services/discord.service";
import DockerService from "#services/docker.service";

vi.mock("#repositories/bot.repository", () => ({
  default: {
    delete: vi.fn(),
    findFirst: vi.fn(),
    findFirstId: vi.fn(),
    findFirstToken: vi.fn(),
    updateToken: vi.fn(),
  },
}));

vi.mock("#services/cluster.service", () => ({
  default: {
    removeAll: vi.fn(),
    stopAll: vi.fn(),
  },
}));
vi.mock("#repositories/cluster.repository", () => ({ default: {} }));

vi.mock("#repositories/container-image.repository", () => ({
  default: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("#repositories/environment-variable.repository", () => ({
  default: {
    findMany: vi.fn(),
    replaceAll: vi.fn(),
  },
}));

vi.mock("#services/discord.service", () => ({
  default: {
    getBotProfile: vi.fn(),
    getGatewayBot: vi.fn(),
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

describe("recommended shards", () => {
  it("returns the number of shards recommended by Discord", async () => {
    vi.mocked(BotRepository.findFirstToken).mockResolvedValue({ token: "token" });
    vi.mocked(DiscordService.getGatewayBot).mockResolvedValue({ shards: 4 });

    expect(await BotService.recommendedShards()).toEqual({ shards: 4 });
    expect(DiscordService.getGatewayBot).toHaveBeenCalledWith("token");
  });

  it("rejects the request when no bot is registered", async () => {
    vi.mocked(BotRepository.findFirstToken).mockResolvedValue(null);

    await expect(BotService.recommendedShards()).rejects.toMatchObject({ status: 404 });
  });
});

describe("missing bot", () => {
  beforeEach(() => {
    vi.mocked(BotRepository.findFirst).mockResolvedValue(null);
    vi.mocked(BotRepository.findFirstId).mockResolvedValue(null);
    vi.mocked(BotRepository.findFirstToken).mockResolvedValue(null);
  });

  it.each([
    ["read it", () => BotService.get()],
    ["update its token", () => BotService.update({ token: "new.token" })],
    ["delete it", () => BotService.delete()],
    ["read its Discord profile", () => BotService.discordProfile()],
    ["read its environment", () => BotService.getEnvironment()],
    ["change its environment", () => BotService.updateEnvironment([])],
  ])("refuses to %s", async (_case, action) => {
    await expect(action()).rejects.toMatchObject({ status: 404, message: "Bot not found" });
    expect(DiscordService.getGatewayBot).not.toHaveBeenCalled();
    expect(ClusterService.stopAll).not.toHaveBeenCalled();
    expect(EnvironmentVariableRepository.replaceAll).not.toHaveBeenCalled();
  });

  it("refuses a container image", async () => {
    vi.mocked(ContainerImageRepository.create).mockResolvedValue(null);

    await expect(BotService.createContainerImage({ url: "nginx:alpine" })).rejects.toMatchObject({
      status: 404,
      message: "Bot not found",
    });
  });
});

describe("environment", () => {
  it("replaces every variable of the bot", async () => {
    const variables = [{ key: "DATABASE_URL", value: "postgres://bot" }];
    vi.mocked(BotRepository.findFirstId).mockResolvedValue({ id: "bot" });
    vi.mocked(EnvironmentVariableRepository.replaceAll).mockResolvedValue(variables);

    expect(await BotService.updateEnvironment(variables)).toEqual(variables);
    expect(EnvironmentVariableRepository.replaceAll).toHaveBeenCalledWith("bot", variables);
  });
});

describe("bot removed while it is being changed", () => {
  beforeEach(() => {
    vi.mocked(BotRepository.findFirstId).mockResolvedValue({ id: "42" });
  });

  it("reports a 404 when the token update finds no bot", async () => {
    vi.mocked(BotRepository.updateToken).mockResolvedValue(null);

    await expect(BotService.update({ token: "new.token" })).rejects.toMatchObject({ status: 404 });
  });

  it("reports a 404 when the delete finds no bot", async () => {
    vi.mocked(BotRepository.delete).mockResolvedValue(null);

    await expect(BotService.delete()).rejects.toMatchObject({ status: 404 });
  });

  it("reports a 404 when the image update finds no image", async () => {
    vi.mocked(ContainerImageRepository.findFirst).mockResolvedValue({
      serverName: "docker.io",
      image: "library/nginx",
      tag: "alpine",
      username: null,
      password: null,
    });
    vi.mocked(ContainerImageRepository.update).mockResolvedValue(null);

    await expect(BotService.updateContainerImage({ url: "nginx:latest" })).rejects.toMatchObject({
      status: 404,
      message: "Container image not found",
    });
  });
});

describe("bot deletion", () => {
  it("stops and removes every cluster before deleting the bot", async () => {
    vi.mocked(BotRepository.findFirstId).mockResolvedValue({ id: "42" });
    vi.mocked(BotRepository.delete).mockResolvedValue({ id: "42", totalShards: 2 });

    await expect(BotService.delete()).resolves.toEqual({ id: "42", shards: 2 });

    const [stopOrder] = vi.mocked(ClusterService.stopAll).mock.invocationCallOrder;
    const [removeOrder] = vi.mocked(ClusterService.removeAll).mock.invocationCallOrder;
    const [deleteOrder] = vi.mocked(BotRepository.delete).mock.invocationCallOrder;
    expect(stopOrder).toBeLessThan(removeOrder);
    expect(removeOrder).toBeLessThan(deleteOrder);
  });
});

describe("Discord profile", () => {
  it("reads the profile with the stored token", async () => {
    vi.mocked(BotRepository.findFirstToken).mockResolvedValue({ token: "stored.token" });

    await BotService.discordProfile();

    expect(DiscordService.getBotProfile).toHaveBeenCalledWith("stored.token");
  });
});
