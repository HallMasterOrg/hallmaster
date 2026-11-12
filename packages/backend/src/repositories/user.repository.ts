import prisma from "#lib/database";
import type { User } from "#prisma/client";

export default class UserRepository {
  static async count() {
    return prisma.user.count();
  }

  static async create(data: User) {
    return prisma.user.create({ data });
  }

  static async findById(id: User["id"]) {
    return prisma.user.findUnique({ where: { id } });
  }
}
