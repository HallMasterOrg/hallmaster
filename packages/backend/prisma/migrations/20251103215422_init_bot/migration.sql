/*
  Warnings:

  - Added the required column `hypervisor` to the `Bot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Hypervisor" AS ENUM ('DOCKER', 'RAW');

-- CreateEnum
CREATE TYPE "ClusterStatus" AS ENUM ('STARTING', 'RUNNING', 'STOPPED', 'ERROR');

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN     "hypervisor" "Hypervisor" NOT NULL,
ADD COLUMN     "sourceCode" TEXT;

-- CreateTable
CREATE TABLE "Cluster" (
    "id" UUID NOT NULL,
    "handleId" TEXT,
    "status" "ClusterStatus" NOT NULL,
    "shardIds" INTEGER[],

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);
