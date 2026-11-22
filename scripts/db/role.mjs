import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import pg from "pg";

const [id, role] = process.argv.slice(2);
if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id ?? "") ||
    !["STUDENT", "INSTRUCTOR", "ADMIN"].includes(role)) {
  throw new Error("Usage: npm run db:role -- <confirmed Auth UUID> <STUDENT|INSTRUCTOR|ADMIN>");
}
const env = parseEnv(await readFile(".local/db/env", "utf8"));
const local = new URL(env.DB_ADMIN_URL);
if (local.hostname !== "127.0.0.1" || local.port !== "55432" || local.pathname !== "/betterlife") {
  throw new Error("This operator command requires the local Better Life development cluster.");
}
const client = new pg.Client({ connectionString: local.href });
await client.connect();
try {
  const result = await client.query(`
    UPDATE app."AppUser" p SET role = $2::app."Role"
    FROM auth.users u
    WHERE p.id = $1::uuid AND u.id = p.id AND u.email_confirmed_at IS NOT NULL
    RETURNING p.id, p.role
  `, [id, role]);
  if (result.rowCount !== 1) throw new Error("Confirm the account email and sign in once before setting its role.");
  console.log(`Assigned ${role} to ${id}.`);
} finally {
  await client.end();
}
