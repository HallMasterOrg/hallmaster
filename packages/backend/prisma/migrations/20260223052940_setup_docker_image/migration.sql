/*
  Warnings:

  - Added the required column `dockerImageId` to the `Bot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "dockerImageId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "DockerImage" (
    "id" TEXT NOT NULL,
    "servername" TEXT NOT NULL DEFAULT 'host.docker.internal:5000',
    "image" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT 'latest',
    "username" TEXT,
    "password" TEXT,

    CONSTRAINT "DockerImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DockerImage_servername_key" ON "DockerImage"("servername");

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_dockerImageId_fkey" FOREIGN KEY ("dockerImageId") REFERENCES "DockerImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
