// Repeat with: npx tsx --test tests/dev-host.test.ts
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { actorAccess, smokeSnapshot } from "../apps/dev-host/src/smoke.ts";
import { courseDbPort, rejectUnisolatedDatabase } from "../apps/dev-host/src/host-adapter.ts";

function files(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (name === "node_modules" || name === ".next" || name === "generated") return [];
    if (statSync(path).isDirectory()) return files(path);
    return [path];
  });
}

function text(path: string) {
  return readFileSync(path, "utf8");
}

test("dev host import boundaries", () => {
  const forbidden = ["@/", "@supabase", "supabase", "@/generated/prisma", "src/generated/prisma", "messages/", "public-page", "modules/identity", "components/header", "components/footer"];
  const source = files("apps/dev-host").filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));
  assert.equal(source.length > 0, true);
  for (const path of source) {
    const sourceText = text(path);
    for (const marker of forbidden) assert.equal(sourceText.includes(marker), false, `${path} contains ${marker}`);
  }
});

test("independent package resolution", () => {
  const config = JSON.parse(text("apps/dev-host/tsconfig.json"));
  assert.equal(config.compilerOptions.paths, undefined);
  const manifest = JSON.parse(text("apps/dev-host/package.json"));
  assert.deepEqual(
    ["@kupragao/lms-contracts", "@kupragao/lms-core", "@kupragao/lms-ui"].map((name) => manifest.dependencies[name]),
    ["0.1.0", "0.1.0", "0.1.0"],
  );
  assert.equal(["lms-contracts", "lms-core", "lms-ui"].some((name) => name in manifest.dependencies), false);
  const smoke = smokeSnapshot();
  assert.equal(smoke.videoRef, "abcdefghijk");
  assert.equal(smoke.progress, 50);
});

test("dev host schema source", () => {
  const marker = "generator client {";
  const canonical = text("prisma/schema.prisma");
  const projection = text("apps/dev-host/prisma/schema.prisma");
  assert.equal(projection.slice(projection.indexOf(marker)), canonical.slice(canonical.indexOf(marker)));
  assert.match(text("apps/dev-host/src/db.ts"), /from "\.\/generated\/prisma\/client"/);
});

test("host adapter compatibility", () => {
  assert.throws(() => rejectUnisolatedDatabase({ hostname: "127.0.0.1", port: "55432", database: "betterlife" }));
  assert.throws(() => rejectUnisolatedDatabase({ hostname: "127.0.0.1", port: "55432", database: "postgres" }));
  assert.doesNotThrow(() => rejectUnisolatedDatabase({ hostname: "127.0.0.1", port: "55432", database: "lms_dev_host" }));
  const previous = process.env.LMS_DEV_HOST_DATABASE_URL;
  delete process.env.LMS_DEV_HOST_DATABASE_URL;
  try {
    assert.throws(() => courseDbPort(), /not initialized/);
    process.env.LMS_DEV_HOST_DATABASE_URL = "postgresql://lms_dev_host_app:local@127.0.0.1:55432/betterlife";
    assert.throws(() => courseDbPort(), /not isolated|cannot use/);
  } finally {
    if (previous === undefined) delete process.env.LMS_DEV_HOST_DATABASE_URL;
    else process.env.LMS_DEV_HOST_DATABASE_URL = previous;
  }
  const adapter = text("apps/dev-host/src/host-adapter.ts");
  assert.equal(adapter.includes("PrismaClient"), false);
  assert.equal(adapter.includes("$queryRaw"), false);
});

test("test actor isolation", () => {
  const markers = [
    "00000000-0000-4000-8000-000000000001", "Dev Admin",
    "00000000-0000-4000-8000-000000000002", "Dev Instructor",
    "00000000-0000-4000-8000-000000000003", "Dev Student",
  ];
  assert.equal(existsSync("packages/lms-contracts"), false);
  assert.equal(existsSync("packages/lms-core"), false);
  assert.equal(existsSync("packages/lms-ui"), false);
  for (const path of [...files("src"), ...files("node_modules/@kupragao")]) {
    if (path.endsWith(".map") || !/\.(ts|tsx|js|mjs)$/.test(path)) continue;
    const sourceText = text(path);
    for (const marker of markers) assert.equal(sourceText.includes(marker), false, `${path} contains a dev-host actor`);
  }
});

test("dev host data isolation", () => {
  for (const path of files("apps/dev-host")) {
    if (path.endsWith("host-adapter.ts") || path.endsWith("README.md")) continue;
    assert.equal(text(path).includes("betterlife"), false, path);
  }
});

test("authorization denials", () => {
  assert.equal(actorAccess("STUDENT").allowed, false);
  assert.equal(actorAccess("STUDENT").code, "denied");
  assert.equal(actorAccess("ADMIN").allowed, true);
  assert.equal(actorAccess("INSTRUCTOR").allowed, true);
  assert.equal(actorAccess("OTHER").allowed, false);
  assert.equal(actorAccess(undefined).code, "missing");
});

test("dev host smoke startup", async () => {
  const env = {
    PATH: process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot ?? "",
    PATHEXT: process.env.PATHEXT ?? "",
    COMSPEC: process.env.COMSPEC ?? "",
    TEMP: process.env.TEMP ?? "",
    TMP: process.env.TMP ?? "",
  };
  const build = spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "build", "--webpack"], {
    cwd: "apps/dev-host", env, stdio: ["ignore", "pipe", "pipe"],
  });
  let buildLog = "";
  build.stdout.on("data", (chunk) => { buildLog += chunk; });
  build.stderr.on("data", (chunk) => { buildLog += chunk; });
  const buildCode = await new Promise((resolve) => build.on("exit", resolve));
  assert.equal(buildCode, 0, buildLog);
  assert.equal(buildLog.includes("Environments:"), false);

  const server = spawn(process.execPath, ["../../node_modules/next/dist/bin/next", "start", "--port", "3199"], {
    cwd: "apps/dev-host", env, stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    let page = "";
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch("http://127.0.0.1:3199/?actor=STUDENT");
        page = await response.text();
        if (response.ok) break;
      } catch { /* the server is still starting */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.match(page, /data-mode="smoke"/);
    assert.match(page, /data-smoke="video">abcdefghijk/);
    assert.match(page, /data-smoke="progress">50/);
    assert.match(page, /data-access="denied"/);
    assert.match(page, /youtube-nocookie.com\/embed\/abcdefghijk/);
    const empty = page.split('data-player="empty"')[1] ?? "";
    assert.equal(empty.includes("<iframe"), false);
    const admin = await (await fetch("http://127.0.0.1:3199/?actor=ADMIN")).text();
    assert.match(admin, /data-access="allowed"/);
  } finally {
    server.kill();
  }
});
