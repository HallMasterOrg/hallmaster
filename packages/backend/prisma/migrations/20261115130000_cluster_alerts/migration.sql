
-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('STOPPED', 'CRASH_LOOP', 'OOM_KILLED');

-- CreateTable
CREATE TABLE "alert" (
    "id" TEXT NOT NULL,
    "bot_id" TEXT NOT NULL,
    "cluster_id" INTEGER NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "message" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_bot_id_resolved_at_idx" ON "alert"("bot_id", "resolved_at");

-- CreateIndex
CREATE INDEX "alert_bot_id_started_at_idx" ON "alert"("bot_id", "started_at");

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

