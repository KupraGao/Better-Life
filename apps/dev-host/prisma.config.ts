import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "prisma/config";

const appDir = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(appDir, "../../.local/db/dev-host-env");
if (!existsSync(envFile)) throw new Error("Dev Host integration database is not initialized");
const env = parseEnv(readFileSync(envFile, "utf8"));
const url = new URL(env.LMS_DEV_HOST_DIRECT_URL ?? "");
if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "55432" ||
    url.pathname !== "/lms_dev_host" || url.username !== "lms_dev_host_migrator" ||
    url.searchParams.has("host") || url.searchParams.has("hostaddr") || url.searchParams.has("port")) {
  throw new Error("dev-host schema target is not isolated");
}

export default defineConfig({
  schema: resolve(appDir, "prisma/schema.prisma"),
  datasource: { url: url.href },
});
