import prisma from "#lib/database";
import type { Prisma, User } from "#prisma/client";

export default class UserRepository {
  static async count() {
    return prisma.user.count();
  }

  static async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  static async findById(id: User["id"]) {
    return prisma.user.findUnique({ where: { id } });
  }

  static async findMany() {
    return prisma.user.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  }

  static async update({ id, ...data }: Prisma.UserUpdateInput & Pick<User, "id">) {
    return prisma.user.update({ where: { id }, data });
  }

  static async deleteById(id: User["id"]) {
    return prisma.user.delete({ where: { id } });
  }

  static async transferOwnership(from: User["id"], to: User["id"]) {
    return prisma.$transaction([
      prisma.user.update({ where: { id: from }, data: { role: "ADMIN" } }),
      prisma.user.update({ where: { id: to }, data: { role: "OWNER" } }),
    ]);
  }
}
