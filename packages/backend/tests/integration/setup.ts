import { inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.SECRET = "integration-secret";
