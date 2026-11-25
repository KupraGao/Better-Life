import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const env = parseEnv(await readFile(resolve(root, ".local/db/dev-host-env"), "utf8"));
const runtime = new URL(env.LMS_DEV_HOST_DATABASE_URL);
if (runtime.hostname !== "127.0.0.1" || runtime.port !== "55432" || runtime.pathname !== "/lms_dev_host" || runtime.username !== "lms_dev_host_app") {
  throw new Error("dev-host runtime target is not isolated");
}
const childEnv = { ...process.env, LMS_DEV_HOST_MODE: "integration", LMS_DEV_HOST_DATABASE_URL: env.LMS_DEV_HOST_DATABASE_URL };
delete childEnv.DATABASE_URL;
delete childEnv.DIRECT_URL;
delete childEnv.AUTH_DB_URL;
delete childEnv.DB_ADMIN_URL;
const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--port", "3100"], {
  cwd: resolve(root, "apps/dev-host"),
  stdio: "inherit",
  env: childEnv,
});
child.on("exit", (code) => process.exit(code ?? 1));
