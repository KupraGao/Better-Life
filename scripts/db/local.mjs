import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

// Standalone local development cluster. Never read a deployment URL here.
const directory = resolve(".local/db");
const settingsFile = resolve(directory, "env");
const dataDirectory = resolve(directory, "data");
const port = 55432;
await mkdir(directory, { recursive: true, mode: 0o700 });

function newUrl(role) {
  const password = randomBytes(32).toString("hex");
  return `postgresql://${role}:${password}@127.0.0.1:${port}/betterlife`;
}

if (!existsSync(settingsFile)) {
  const settings = [
    `DB_ADMIN_URL=${newUrl("postgres")}`,
    `DIRECT_URL=${newUrl("betterlife_migrator")}?schema=app`,
    `DATABASE_URL=${newUrl("betterlife_app")}`,
    `AUTH_DB_URL=${newUrl("supabase_auth_admin")}`,
  ];
  await writeFile(settingsFile, settings.join("\n") + "\n", { flag: "wx", mode: 0o600 });
}
const env = parseEnv(await readFile(settingsFile, "utf8"));
const roleUrls = [env.DIRECT_URL, env.DATABASE_URL, env.AUTH_DB_URL].map((value) => new URL(value));
const cluster = new EmbeddedPostgres({
  databaseDir: dataDirectory,
  user: "postgres",
  password: new URL(env.DB_ADMIN_URL).password,
  port,
  authMethod: "scram-sha-256",
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
});

if (!existsSync(resolve(dataDirectory, "PG_VERSION"))) await cluster.initialise();
await cluster.start();

async function withAdmin(database, callback) {
  const client = cluster.getPgClient(database, "127.0.0.1");
  await client.connect();
  try {
    await callback(client);
  } finally {
    await client.end();
  }
}

try {
  await withAdmin("postgres", async (client) => {
    for (const url of roleUrls) {
      const { rows } = await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [url.username]);
      if (rows.length === 0) {
        await client.query(`CREATE ROLE ${pg.escapeIdentifier(url.username)}
          LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
          PASSWORD ${pg.escapeLiteral(url.password)}`);
      }
    }
    for (const name of ["anon", "authenticated"]) {
      const { rows } = await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [name]);
      if (rows.length === 0) await client.query(`CREATE ROLE ${pg.escapeIdentifier(name)} NOLOGIN`);
    }
    const database = await client.query("SELECT 1 FROM pg_database WHERE datname='betterlife'");
    if (database.rowCount === 0) await client.query("CREATE DATABASE betterlife");
  });

  await withAdmin("betterlife", async (client) => {
    await client.query(`
      REVOKE ALL ON DATABASE betterlife FROM PUBLIC;
      GRANT CONNECT ON DATABASE betterlife TO betterlife_app, betterlife_migrator, supabase_auth_admin;
      -- CREATE SCHEMA in migration 001 requires this even when the schema already exists.
      GRANT CREATE ON DATABASE betterlife TO betterlife_migrator;
      CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION betterlife_migrator;
      CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
      REVOKE ALL ON SCHEMA app, auth FROM PUBLIC, anon, authenticated;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      ALTER ROLE betterlife_app IN DATABASE betterlife SET search_path = app;
      ALTER ROLE betterlife_migrator IN DATABASE betterlife SET search_path = app;
      ALTER ROLE supabase_auth_admin IN DATABASE betterlife SET search_path = auth, public;
    `);
  });
  const existing = existsSync(".env") ? parseEnv(await readFile(".env", "utf8")) : {};
  if (!existing.DATABASE_URL) {
    await appendFile(".env", `\nDATABASE_URL=${env.DATABASE_URL}\n`, { mode: 0o600 });
  }
  console.log("Local PostgreSQL is ready on 127.0.0.1:55432. Keep this process running.");
} catch (error) {
  await cluster.stop();
  throw error;
}
