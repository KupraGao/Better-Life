import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import test from "node:test";
import pg from "pg";

async function localConnection(key: "DATABASE_URL" | "DB_ADMIN_URL") {
  const env = parseEnv(await readFile(".local/db/env", "utf8"));
  const url = new URL(env[key]);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55432");
  assert.equal(url.pathname, "/betterlife");
  const conn = new pg.Client({ connectionString: url.href });
  await conn.connect();
  return conn;
}

test("browser roles have no app table privileges and cannot read profiles", async () => {
  const conn = await localConnection("DB_ADMIN_URL");
  try {
    for (const role of ["anon", "authenticated"]) {
      await conn.query("BEGIN");
      await conn.query(`SET LOCAL ROLE ${pg.escapeIdentifier(role)}`);
      const result = await conn.query(`
        SELECT has_schema_privilege(current_user, 'app', 'USAGE') AS usage,
               count(*) FILTER (WHERE has_table_privilege(current_user, c.oid, 'SELECT, INSERT, UPDATE, DELETE'))::int AS grants
        FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'app' AND c.relkind = 'r'`);
      assert.deepEqual(result.rows[0], { usage: false, grants: 0 });
      await assert.rejects(conn.query('SELECT id FROM app."AppUser"'), { code: "42501" });
      await conn.query("ROLLBACK");
    }
  } finally {
    await conn.end();
  }
});

test("runtime is restricted to application data and can create only student profiles", async () => {
  const conn = await localConnection("DATABASE_URL");
  try {
    const result = await conn.query(`
      SELECT current_user AS name, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls,
             has_schema_privilege(current_user, 'app', 'CREATE') AS ddl,
             has_schema_privilege(current_user, 'auth', 'USAGE') AS auth
      FROM pg_roles WHERE rolname = current_user`);
    assert.deepEqual(result.rows[0], {
      name: "betterlife_app", rolsuper: false, rolcreaterole: false, rolcreatedb: false,
      rolbypassrls: false, ddl: false, auth: false,
    });
    const policies = await conn.query(`
      SELECT bool_and(c.relrowsecurity AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname=current_user)) AS protected
      FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
      WHERE n.nspname='app' AND c.relkind='r' AND c.relname <> '_prisma_migrations'`);
    assert.equal(policies.rows[0].protected, true);
    await conn.query("BEGIN");
    const id = randomUUID();
    await conn.query('INSERT INTO app."AppUser"(id, "displayName") VALUES ($1, $2)', [id, "Test learner"]);
    await conn.query('UPDATE app."AppUser" SET "displayName"=$2 WHERE id=$1', [id, "Renamed"]);
    await conn.query("SAVEPOINT attempt");
    await assert.rejects(conn.query('UPDATE app."AppUser" SET role=$2 WHERE id=$1', [id, "ADMIN"]), { code: "42501" });
    await conn.query("ROLLBACK TO SAVEPOINT attempt");
    await assert.rejects(conn.query('INSERT INTO app."AppUser"(id,"displayName",role) VALUES ($1,$2,$3)', [randomUUID(), "Test admin", "ADMIN"]), { code: "42501" });
    await conn.query("ROLLBACK");
  } finally {
    await conn.end();
  }
});
