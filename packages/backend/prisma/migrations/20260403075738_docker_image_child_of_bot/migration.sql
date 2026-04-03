/*
  Warnings:

  - You are about to drop the column `docker_image_id` on the `bot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bot_id]` on the table `docker_image` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bot_id` to the `docker_image` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "bot" DROP CONSTRAINT "bot_docker_image_id_fkey";

-- AlterTable
ALTER TABLE "bot" DROP COLUMN "docker_image_id";

-- AlterTable
ALTER TABLE "docker_image" ADD COLUMN     "bot_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "docker_image_bot_id_key" ON "docker_image"("bot_id");

-- AddForeignKey
ALTER TABLE "docker_image" ADD CONSTRAINT "docker_image_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
