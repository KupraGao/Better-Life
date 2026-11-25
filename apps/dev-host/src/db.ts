import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const runtimeRole = "lms_dev_host_app";

export function runtimeUrl() {
  const raw = process.env.LMS_DEV_HOST_DATABASE_URL;
  if (!raw) throw new Error("Dev Host integration database is not initialized");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "55432" || database !== "lms_dev_host") {
    throw new Error("dev-host database name is not isolated");
  }
  if (url.username !== runtimeRole || url.searchParams.has("host") || url.searchParams.has("hostaddr") || url.searchParams.has("port")) {
    throw new Error("dev-host runtime role is not isolated");
  }
  return url;
}

export function openDb() {
  const adapter = new PrismaPg({ connectionString: runtimeUrl().href, max: 4, pipeline: true }, { schema: "app" });
  return new PrismaClient({ adapter });
}

const shared = globalThis as typeof globalThis & { lmsDevHostDb?: PrismaClient };
let verified = false;

export function getDb() {
  shared.lmsDevHostDb ??= openDb();
  return shared.lmsDevHostDb;
}

export async function assertRuntimeConnection() {
  const row = await identity(getDb());
  if (!verified) verified = true;
  return row;
}

async function identity(client: PrismaClient) {
  const [row] = await client.$queryRaw<{ db: string; role: string; port: number; addr: string }[]>`
    SELECT current_database() AS db, current_user AS role, inet_server_port() AS port, inet_server_addr()::text AS addr`;
  if (row?.db !== "lms_dev_host" || row.role !== runtimeRole || Number(row.port) !== 55432 || !String(row.addr).startsWith("127.0.0.1")) {
    throw new Error("dev-host connection is not isolated");
  }
  return row;
}

export const courseDb = {
  async lockActor(tx: { $queryRaw: PrismaClient["$queryRaw"] }, id: string) {
    const [actor] = await tx.$queryRaw<{ id: string; role: string }[]>`
      SELECT id, role::text AS role FROM app."AppUser" WHERE id = ${id}::uuid FOR SHARE`;
    return actor ?? null;
  },
  async lockCourse(tx: { $queryRaw: PrismaClient["$queryRaw"] }, courseId: string) {
    await tx.$queryRaw`SELECT id FROM app."Course" WHERE id = ${courseId}::uuid FOR UPDATE`;
  },
  async foreignCourseId(tx: { $queryRaw: PrismaClient["$queryRaw"] }, courseId: string, slug: string) {
    const [row] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app."Course" WHERE slug = ${slug} AND id <> ${courseId}::uuid FOR UPDATE`;
    return row?.id ?? null;
  },
  async foreignAliasCourseId(tx: { $queryRaw: PrismaClient["$queryRaw"] }, courseId: string, slug: string) {
    const [row] = await tx.$queryRaw<{ courseId: string }[]>`
      SELECT "courseId" FROM app."CourseSlugAlias" WHERE slug = ${slug} AND "courseId" <> ${courseId}::uuid FOR UPDATE`;
    return row?.courseId ?? null;
  },
  async appUserRole(tx: { appUser: { findUnique: PrismaClient["appUser"]["findUnique"] } }, userId: string) {
    const target = await tx.appUser.findUnique({ where: { id: userId }, select: { role: true } });
    return target?.role ?? null;
  },
};

type LearningTx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

export async function commitLearningChange<T>(operation: (tx: LearningTx) => Promise<T>) {
  const db = getDb();
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : null;
      if (attempt >= 3 || (code !== "P2034" && code !== "P2002")) throw error;
    }
  }
}
