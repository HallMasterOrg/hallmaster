/*
  Warnings:

  - You are about to drop the column `clusters` on the `Bot` table. All the data in the column will be lost.
  - The primary key for the `Cluster` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `clusterNumber` to the `Bot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `botId` to the `Cluster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Bot" DROP COLUMN "clusters",
ADD COLUMN     "clusterNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Cluster" DROP CONSTRAINT "Cluster_pkey",
ADD COLUMN     "botId" TEXT NOT NULL,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
