-- CreateEnum
CREATE TYPE "ClusterDesiredStatus" AS ENUM ('RUNNING', 'STOPPED');

-- AlterTable
ALTER TABLE "cluster" ADD COLUMN "desired_status" "ClusterDesiredStatus";

UPDATE "cluster"
SET "desired_status" = CASE WHEN "status" = 'STOPPED' THEN 'STOPPED' ELSE 'RUNNING' END::"ClusterDesiredStatus";

ALTER TABLE "cluster" ALTER COLUMN "desired_status" SET NOT NULL,
DROP COLUMN "status";

-- DropEnum
DROP TYPE "ClusterStatus";
