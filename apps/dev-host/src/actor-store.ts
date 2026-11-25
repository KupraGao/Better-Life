import { assertRuntimeConnection, getDb } from "./db";

/** The role always comes from the isolated database row. */
export async function loadActor(id: string) {
  await assertRuntimeConnection();
  return getDb().appUser.findUnique({ where: { id }, select: { id: true, role: true, displayName: true } });
}
