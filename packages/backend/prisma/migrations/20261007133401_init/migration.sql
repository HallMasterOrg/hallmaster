-- CreateEnum
CREATE TYPE "ClusterStatus" AS ENUM ('STARTING', 'RUNNING', 'STOPPED', 'UPDATING', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "bot" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "total_shards" INTEGER NOT NULL,

    CONSTRAINT "bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "container_image" (
    "id" TEXT NOT NULL,
    "server_name" TEXT NOT NULL DEFAULT 'host.docker.internal:5000',
    "image" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT 'latest',
    "username" TEXT,
    "password" TEXT,
    "bot_id" TEXT NOT NULL,

    CONSTRAINT "container_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster" (
    "id" INTEGER NOT NULL,
    "bot_id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "status" "ClusterStatus" NOT NULL,
    "shard_ids" INTEGER[],

    CONSTRAINT "cluster_pkey" PRIMARY KEY ("bot_id","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "container_image_server_name_key" ON "container_image"("server_name");

-- CreateIndex
CREATE UNIQUE INDEX "container_image_bot_id_key" ON "container_image"("bot_id");

-- AddForeignKey
ALTER TABLE "container_image" ADD CONSTRAINT "container_image_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster" ADD CONSTRAINT "cluster_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
