import { execFileSync } from "node:child_process";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const database = await new PostgreSqlContainer("postgres:17-alpine").start();
  const databaseUrl = database.getConnectionUri();

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "ignore",
  });

  project.provide("databaseUrl", databaseUrl);

  return async () => {
    await database.stop();
  };
}
