import BotRepository from "#repositories/bot.repository";
import ContainerImageRepository from "#repositories/container-image.repository";
import UserRepository from "#repositories/user.repository";
import type { Status } from "#schemas/status.schema";

export default class StatusService {
  public static async get(): Promise<Status> {
    const [users, bots, containerImages] = await Promise.all([
      UserRepository.count(),
      BotRepository.count(),
      ContainerImageRepository.count(),
    ]);

    return {
      hasUser: users > 0,
      hasBot: bots > 0 && containerImages > 0,
    };
  }
}
