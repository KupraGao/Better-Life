import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// CLI only. The runtime server never loads the migration credential.
if (existsSync(".local/db/env")) process.loadEnvFile(".local/db/env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL },
});
