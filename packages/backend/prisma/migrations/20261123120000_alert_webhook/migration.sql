CREATE TABLE "alert_webhook" (
    "bot_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "webhook_token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "content" TEXT NOT NULL,
    "kinds" "AlertKind"[],
    "notify_resolved" BOOLEAN NOT NULL,
    "last_delivered_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "alert_webhook_pkey" PRIMARY KEY ("bot_id")
);

ALTER TABLE "alert_webhook" ADD CONSTRAINT "alert_webhook_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

