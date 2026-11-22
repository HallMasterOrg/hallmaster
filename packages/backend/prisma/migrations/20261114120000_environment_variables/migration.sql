CREATE TABLE "environment_variable" (
    "bot_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "environment_variable_pkey" PRIMARY KEY ("bot_id","key")
);

ALTER TABLE "environment_variable" ADD CONSTRAINT "environment_variable_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
