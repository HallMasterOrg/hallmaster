import { inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.SECRET = "integration-secret";
process.env.DISCORD_CLIENT_ID = "integration-client";
process.env.DISCORD_CLIENT_SECRET = "integration-secret";
