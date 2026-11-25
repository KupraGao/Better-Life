import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const port = 55432;
const databaseName = "lms_dev_host";
const migratorRole = "lms_dev_host_migrator";
const runtimeRole = "lms_dev_host_app";
const envFile = resolve(root, ".local/db/dev-host-env");
const actors = [
  ["00000000-0000-4000-8000-000000000001", "Dev Admin", "ADMIN"],
  ["00000000-0000-4000-8000-000000000002", "Dev Instructor", "INSTRUCTOR"],
  ["00000000-0000-4000-8000-000000000003", "Dev Student", "STUDENT"],
];

function assertAdmin(url) {
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== String(port) || url.username !== "postgres") {
    throw new Error("dev-host init requires the local cluster");
  }
  if (url.searchParams.has("host") || url.searchParams.has("hostaddr") || url.searchParams.has("port")) {
    throw new Error("dev-host init rejects an overridden target");
  }
}

async function connect(database, user, password) {
  const client = new pg.Client({ host: "127.0.0.1", port, database, user, password });
  await client.connect();
  return client;
}

async function identify(client, database, role) {
  const { rows } = await client.query(
    "SELECT current_database() AS db, current_user AS role, inet_server_port() AS port, inet_server_addr()::text AS addr",
  );
  const row = rows[0];
  if (row.db !== database || row.role !== role || Number(row.port) !== port || !String(row.addr).startsWith("127.0.0.1")) {
    throw new Error(`refusing to continue because the connection is ${row.db} as ${row.role}`);
  }
}

function secretFor(existing, role) {
  const key = role === migratorRole ? "LMS_DEV_HOST_DIRECT_URL" : "LMS_DEV_HOST_DATABASE_URL";
  if (existing[key]) return new URL(existing[key]).password;
  return randomBytes(32).toString("hex");
}

async function prisma(args) {
  const output = await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [
      resolve(root, "node_modules/prisma/build/index.js"), ...args, "--config", resolve(root, "apps/dev-host/prisma.config.ts"),
    ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    child.stdout.on("data", (chunk) => { text += chunk; });
    child.stderr.on("data", (chunk) => { text += chunk; });
    child.on("exit", (code) => {
      if (!text.includes("dev-host") || !text.includes("prisma.config.ts")) {
        reject(new Error(`prisma ${args.join(" ")} did not load the dev-host config`));
        return;
      }
      if (code === 0) resolvePromise(text);
      else reject(new Error(`prisma ${args.join(" ")} failed`));
    });
  });
  if (output.includes("betterlife")) throw new Error(`prisma ${args.join(" ")} mentioned the BetterLife database`);
  return output;
}

const adminEnv = parseEnv(await readFile(resolve(root, ".local/db/env"), "utf8"));
const admin = new URL(adminEnv.DB_ADMIN_URL);
assertAdmin(admin);
const saved = existsSync(envFile) ? parseEnv(await readFile(envFile, "utf8")) : {};
const migratorPassword = secretFor(saved, migratorRole);
const runtimePassword = secretFor(saved, runtimeRole);

const catalog = await connect("postgres", admin.username, admin.password);
try {
  await identify(catalog, "postgres", "postgres");
  const acls = await catalog.query("SELECT datname, datacl::text AS acl FROM pg_database WHERE datname = 'betterlife'");
  const acl = acls.rows[0]?.acl ?? "";
  if (/(?:\{|,)=/.test(acl)) throw new Error("PUBLIC can reach the BetterLife database; init stopped before any grant change");
  for (const name of [migratorRole, runtimeRole]) {
    if (acl.includes(name)) throw new Error("a dev-host role is present on the BetterLife database; init stopped");
  }
  for (const [name, password] of [[migratorRole, migratorPassword], [runtimeRole, runtimePassword]]) {
    const found = await catalog.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolinherit FROM pg_roles WHERE rolname = $1", [name]);
    if (found.rowCount === 0) {
      await catalog.query(`CREATE ROLE ${pg.escapeIdentifier(name)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ${pg.escapeLiteral(password)}`);
    } else if (found.rows[0].rolsuper || found.rows[0].rolcreatedb || found.rows[0].rolcreaterole || found.rows[0].rolinherit) {
      throw new Error("dev-host role flags are not minimal");
    } else {
      await catalog.query(`ALTER ROLE ${pg.escapeIdentifier(name)} PASSWORD ${pg.escapeLiteral(password)}`);
    }
    const exists = await catalog.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (exists.rowCount === 0) await catalog.query(`CREATE DATABASE ${pg.escapeIdentifier(databaseName)}`);
  }
} finally {
  await catalog.end();
}

const owner = await connect(databaseName, admin.username, admin.password);
try {
  await identify(owner, databaseName, "postgres");
  await owner.query(`
    REVOKE ALL ON DATABASE ${pg.escapeIdentifier(databaseName)} FROM PUBLIC;
    GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(databaseName)} TO ${pg.escapeIdentifier(migratorRole)}, ${pg.escapeIdentifier(runtimeRole)};
    GRANT CREATE ON DATABASE ${pg.escapeIdentifier(databaseName)} TO ${pg.escapeIdentifier(migratorRole)};
    CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION ${pg.escapeIdentifier(migratorRole)};
    REVOKE ALL ON SCHEMA app FROM PUBLIC;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    ALTER ROLE ${pg.escapeIdentifier(runtimeRole)} IN DATABASE ${pg.escapeIdentifier(databaseName)} SET search_path = app;
    ALTER ROLE ${pg.escapeIdentifier(migratorRole)} IN DATABASE ${pg.escapeIdentifier(databaseName)} SET search_path = app;
  `);
} finally {
  await owner.end();
}

const directUrl = `postgresql://${migratorRole}:${migratorPassword}@127.0.0.1:${port}/${databaseName}?schema=app`;
const runtimeUrl = `postgresql://${runtimeRole}:${runtimePassword}@127.0.0.1:${port}/${databaseName}`;
await writeFile(envFile, `LMS_DEV_HOST_DIRECT_URL=${directUrl}\nLMS_DEV_HOST_DATABASE_URL=${runtimeUrl}\n`, { mode: 0o600 });
await chmod(envFile, 0o600);

await prisma(["generate"]);
await prisma(["db", "push"]);

const granted = await connect(databaseName, admin.username, admin.password);
try {
  await identify(granted, databaseName, "postgres");
  await granted.query(`
    REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
    GRANT USAGE ON SCHEMA app TO ${pg.escapeIdentifier(runtimeRole)};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO ${pg.escapeIdentifier(runtimeRole)};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO ${pg.escapeIdentifier(runtimeRole)};
    ALTER DEFAULT PRIVILEGES FOR ROLE ${pg.escapeIdentifier(migratorRole)} IN SCHEMA app
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${pg.escapeIdentifier(runtimeRole)};
    ALTER DEFAULT PRIVILEGES FOR ROLE ${pg.escapeIdentifier(migratorRole)} IN SCHEMA app
      GRANT USAGE, SELECT ON SEQUENCES TO ${pg.escapeIdentifier(runtimeRole)};
  `);
  for (const [id, name, role] of actors) {
    await granted.query(`
      INSERT INTO app."AppUser" (id, "displayName", role)
      VALUES ($1::uuid, $2, $3::app."Role")
      ON CONFLICT (id) DO UPDATE SET "displayName" = EXCLUDED."displayName", role = EXCLUDED.role
    `, [id, name, role]);
  }
  const owners = await granted.query("SELECT COUNT(*)::int AS foreign FROM pg_tables WHERE schemaname = 'app' AND tableowner <> $1", [migratorRole]);
  if (owners.rows[0].foreign !== 0) throw new Error("dev-host tables are not owned by the schema role");
  const connectBetterLife = await granted.query("SELECT has_database_privilege($1, 'betterlife', 'CONNECT') AS allowed", [runtimeRole]);
  if (connectBetterLife.rows[0].allowed !== false) throw new Error("dev-host runtime can connect to the BetterLife database");
} finally {
  await granted.end();
}

const runtime = await connect(databaseName, runtimeRole, runtimePassword);
try {
  await identify(runtime, databaseName, runtimeRole);
} finally {
  await runtime.end();
}

let blocked = false;
try {
  const probe = await connect("betterlife", runtimeRole, runtimePassword);
  await probe.end();
} catch {
  blocked = true;
}
if (!blocked) throw new Error("dev-host runtime opened the BetterLife database");
console.log("lms_dev_host is ready. The runtime role cannot open the BetterLife database.");
