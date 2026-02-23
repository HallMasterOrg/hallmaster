/*
  Warnings:

  - You are about to drop the `Bot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Cluster` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DockerImage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Bot" DROP CONSTRAINT "Bot_dockerImageId_fkey";

-- DropForeignKey
ALTER TABLE "Cluster" DROP CONSTRAINT "Cluster_botId_fkey";

-- DropTable
DROP TABLE "Bot";

-- DropTable
DROP TABLE "Cluster";

-- DropTable
DROP TABLE "DockerImage";

-- CreateTable
CREATE TABLE "bot" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "total_shards" INTEGER NOT NULL,
    "docker_image_id" TEXT NOT NULL,

    CONSTRAINT "bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docker_image" (
    "id" TEXT NOT NULL,
    "server_name" TEXT NOT NULL DEFAULT 'host.docker.internal:5000',
    "image" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT 'latest',
    "username" TEXT,
    "password" TEXT,

    CONSTRAINT "docker_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "container_id" TEXT,
    "status" "ClusterStatus" NOT NULL,
    "shard_ids" INTEGER[],

    CONSTRAINT "cluster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "docker_image_server_name_key" ON "docker_image"("server_name");

-- AddForeignKey
ALTER TABLE "bot" ADD CONSTRAINT "bot_docker_image_id_fkey" FOREIGN KEY ("docker_image_id") REFERENCES "docker_image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster" ADD CONSTRAINT "cluster_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
