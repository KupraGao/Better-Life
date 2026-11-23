import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import pg from "pg";

const [id, role] = process.argv.slice(2);
if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id ?? "") ||
    !["STUDENT", "INSTRUCTOR", "ADMIN"].includes(role)) {
  throw new Error("Usage: node scripts/db/role.mjs <existing profile UUID> <STUDENT|INSTRUCTOR|ADMIN>");
}
const env = parseEnv(await readFile(".local/db/env", "utf8"));
const local = new URL(env.DB_ADMIN_URL);
if (local.protocol !== "postgresql:" || local.hostname !== "127.0.0.1" || local.port !== "55432" ||
    local.pathname !== "/betterlife" || local.searchParams.has("host") || local.searchParams.has("port") ||
    local.searchParams.has("hostaddr")) {
  throw new Error("This operator command requires the local Better Life development cluster.");
}
const client = new pg.Client({
  host: "127.0.0.1",
  port: 55432,
  database: "betterlife",
  user: local.username,
  password: local.password,
});
await client.connect();
try {
  const where = await client.query(`SELECT current_database() AS db, inet_server_addr()::text AS addr, inet_server_port() AS port`);
  const connected = where.rows[0];
  if (connected.db !== "betterlife" || Number(connected.port) !== 55432 || !String(connected.addr).startsWith("127.0.0.1")) {
    throw new Error("This operator command requires the local Better Life development cluster.");
  }
  // The role authority is the local profile. Hosted Auth metadata is not consulted.
  const result = await client.query(`
    UPDATE app."AppUser"
    SET role = $2::app."Role"
    WHERE id = $1::uuid
    RETURNING id, role::text AS role
  `, [id, role]);
  if (result.rowCount !== 1 || result.rows[0].role !== role) {
    throw new Error("Sign in once so the local profile exists before setting its role.");
  }
  console.log(`Assigned ${role} to ${id}.`);
} finally {
  await client.end();
}
