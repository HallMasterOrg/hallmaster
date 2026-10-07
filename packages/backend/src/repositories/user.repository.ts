import prisma from "#lib/database";
import type { User } from "#prisma/client";

export default class UserRepository {
  static async create(data: User) {
    return prisma.user.create({ select: { username: true }, data });
  }

  static async findFirstByUsername(username: User["username"]) {
    return prisma.user.findFirst({
      select: { username: true, passwordHash: true },
      where: {
        username,
      },
    });
  }
}
