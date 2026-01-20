-- CreateEnum
CREATE TYPE "ClusterStatus" AS ENUM ('STARTING', 'RUNNING', 'STOPPED', 'ERROR');

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "clusterNumber" INTEGER NOT NULL,
    "shards" INTEGER NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cluster" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "containerId" TEXT,
    "status" "ClusterStatus" NOT NULL,
    "shardIds" INTEGER[],

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
