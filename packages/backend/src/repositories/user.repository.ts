import prisma from "#lib/database";
import { Prisma, type User } from "#prisma/client";

export default class UserRepository {
  static async count() {
    return prisma.user.count();
  }

  static async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  static async createOwner(data: Omit<Prisma.UserCreateInput, "role">) {
    try {
      return await prisma.user.create({ data: { ...data, role: "OWNER" } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return null;

      throw error;
    }
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

  static async deleteAdminById(id: User["id"]) {
    const { count } = await prisma.user.deleteMany({ where: { id, role: "ADMIN" } });

    return count > 0;
  }

  static async transferOwnership(from: User["id"], to: User["id"]) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: from, role: "OWNER" },
        data: { role: "ADMIN" },
      });
      if (count === 0) return false;

      await tx.user.update({ where: { id: to }, data: { role: "OWNER" } });

      return true;
    });
  }
}
