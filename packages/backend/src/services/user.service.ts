import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "#exceptions/http-exceptions";
import type { User as UserRow } from "#prisma/client";
import BotRepository from "#repositories/bot.repository";
import UserRepository from "#repositories/user.repository";
import type { User, UserId } from "#schemas/user.schema";

import DiscordService from "./discord.service";

export default class UserService {
  public static toUser(user: UserRow): User {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: DiscordService.avatarUrl(user.id, user.avatar),
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private static async findById(id: UserId) {
    const user = await UserRepository.findById(id);
    if (user === null) throw new NotFoundException({ message: "User not found" });

    return user;
  }

  public static async getAll(): Promise<User[]> {
    const users = await UserRepository.findMany();

    return users.map((user) => this.toUser(user));
  }

  public static async addAdmin(id: UserId): Promise<User> {
    if ((await UserRepository.findById(id)) !== null)
      throw new ConflictException({ message: "This Discord account can already log in" });

    const bot = await BotRepository.findFirstIdAndToken();
    if (bot === null) throw new NotFoundException({ message: "Bot not found" });

    const { username, global_name, avatar } = await DiscordService.getUserById(bot.token, id);
    const user = await UserRepository.create({
      id,
      username,
      displayName: global_name,
      avatar,
      role: "ADMIN",
    });

    return this.toUser(user);
  }

  public static async removeAdmin(id: UserId) {
    const user = await this.findById(id);
    if (user.role === "OWNER")
      throw new BadRequestException({ message: "The owner cannot be removed" });

    await UserRepository.deleteById(id);
  }

  public static async transferOwnership(owner: UserRow, id: UserId): Promise<User[]> {
    const user = await this.findById(id);
    if (user.id === owner.id)
      throw new BadRequestException({ message: "This user is already the owner" });

    await UserRepository.transferOwnership(owner.id, user.id);

    return this.getAll();
  }
}
