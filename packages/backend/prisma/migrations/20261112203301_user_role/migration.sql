-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'ADMIN';

UPDATE "User" SET "role" = 'OWNER';

-- CreateIndex
CREATE UNIQUE INDEX "User_role_key" ON "User"("role") WHERE ("role" = 'OWNER');
