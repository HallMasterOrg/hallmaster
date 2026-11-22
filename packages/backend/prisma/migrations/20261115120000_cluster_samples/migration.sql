CREATE TABLE "cluster_sample" (
    "bot_id" TEXT NOT NULL,
    "cluster_id" INTEGER NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "cpu_percentage" DOUBLE PRECISION NOT NULL,
    "memory_usage" BIGINT NOT NULL,
    "memory_percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "cluster_sample_pkey" PRIMARY KEY ("bot_id","cluster_id","at")
);

CREATE INDEX "cluster_sample_at_idx" ON "cluster_sample"("at");

ALTER TABLE "cluster_sample" ADD CONSTRAINT "cluster_sample_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
