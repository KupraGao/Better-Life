// Repeat with: npx tsx --test tests/dev-host-integration.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { testActors } from "../apps/dev-host/src/actors.ts";
import {
  addDevAsset, assignDevInstructor, completeDevLesson, createDevCourse, enrollDevStudent,
  openDevCourse, openDevLesson, publishDevCourse, readDevAsset, saveDevAccess, saveDevBasics, saveDevPlan,
} from "../apps/dev-host/src/cycle.ts";
import { assertRuntimeConnection, getDb, openDb } from "../apps/dev-host/src/db.ts";
import { loadActor } from "../apps/dev-host/src/actor-store.ts";

const env = parseEnv(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../.local/db/dev-host-env"), "utf8"));
function denied(error: unknown) {
  return error instanceof Error && error.message === "denied";
}
const admin = testActors.ADMIN.id;
const instructor = testActors.INSTRUCTOR.id;
const student = testActors.STUDENT.id;
const lesson = { title: "Visible lesson", body: "Visible lesson body.", video: "https://youtu.be/abcdefghijk", published: true };

async function wipe() {
  const db = getDb();
  const courses = await db.course.findMany({ where: { slug: { startsWith: "dh-test-" } }, select: { id: true } });
  const ids = courses.map((course) => course.id);
  if (!ids.length) return;
  const owned = { module: { courseId: { in: ids } } };
  await db.progress.deleteMany({ where: { item: owned } });
  await db.lessonAsset.deleteMany({ where: { item: owned } });
  await db.itemTranslation.deleteMany({ where: { item: owned } });
  await db.learningItem.deleteMany({ where: owned });
  await db.module.deleteMany({ where: { courseId: { in: ids } } });
  await db.enrollment.deleteMany({ where: { courseId: { in: ids } } });
  await db.courseInstructor.deleteMany({ where: { courseId: { in: ids } } });
  await db.courseCategory.deleteMany({ where: { courseId: { in: ids } } });
  await db.courseSlugAlias.deleteMany({ where: { courseId: { in: ids } } });
  await db.courseTranslation.deleteMany({ where: { courseId: { in: ids } } });
  await db.course.deleteMany({ where: { id: { in: ids } } });
}

async function build(slug: string) {
  const courseId = await createDevCourse(admin, slug, slug);
  await saveDevBasics(admin, courseId, slug, slug);
  const plan = await saveDevPlan(admin, courseId, lesson, { title: "Hidden lesson" });
  await saveDevAccess(admin, courseId);
  await publishDevCourse(admin, courseId);
  await assignDevInstructor(admin, courseId, instructor);
  return { courseId, visibleId: plan.plan.modules[0].lessons[0].id, hiddenId: plan.plan.modules[0].lessons[1].id };
}

test.before(async () => {
  process.env.LMS_DEV_HOST_DATABASE_URL = env.LMS_DEV_HOST_DATABASE_URL;
  const row = await assertRuntimeConnection();
  assert.equal(row.db, "lms_dev_host");
  assert.equal(row.role, "lms_dev_host_app");
  await getDb().$executeRaw`SELECT pg_advisory_lock(1842005)`;
  await wipe();
});

test.after(async () => {
  await wipe();
  await getDb().$executeRaw`SELECT pg_advisory_unlock(1842005)`;
});

test("dev host database isolation", async () => {
  const [privilege] = await getDb().$queryRaw<{ allowed: boolean }[]>`
    SELECT has_database_privilege(current_user, 'betterlife', 'CONNECT') AS allowed`;
  assert.equal(privilege.allowed, false);
  const runtime = new URL(env.LMS_DEV_HOST_DATABASE_URL);
  const { Client } = await import("pg");
  const probe = new Client({ host: "127.0.0.1", port: 55432, database: "betterlife", user: runtime.username, password: runtime.password });
  await assert.rejects(() => probe.connect());
});

test("dev host environment isolation", async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://nope:nope@127.0.0.1:55432/betterlife";
  try {
    const row = await assertRuntimeConnection();
    assert.equal(row.db, "lms_dev_host");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});

test("dev host adapter reads the stored role", async () => {
  const stored = await loadActor(student);
  assert.equal(stored?.role, "STUDENT");
  assert.equal(stored?.displayName, "Dev Student");
  await assert.rejects(() => createDevCourse(student, "dh-test-student-create", "Denied"), denied);
});

test("dev host course lifecycle", async () => {
  const slug = "dh-test-lifecycle";
  const course = await build(slug);
  const saved = await getDb().course.findUniqueOrThrow({
    where: { id: course.courseId },
    select: { published: true, freeEnrollment: true, translations: { select: { title: true } } },
  });
  assert.equal(saved.published, true);
  assert.equal(saved.freeEnrollment, true);
  assert.equal(saved.translations[0].title, slug);
  const visible = await openDevLesson(student, slug, course.visibleId);
  assert.equal(visible, null);
  assert.equal(await enrollDevStudent(student, slug), true);
  const opened = await openDevLesson(student, slug, course.visibleId);
  assert.equal(opened?.videoRef, "abcdefghijk");
  assert.equal(opened?.videoSource, "YOUTUBE");
});

test("dev host authorization denials", async () => {
  const own = await build("dh-test-own");
  const foreign = await createDevCourse(admin, "dh-test-foreign", "Foreign");
  await saveDevBasics(instructor, own.courseId, "dh-test-own", "Instructor edit");
  await assert.rejects(() => saveDevBasics(instructor, foreign, "dh-test-foreign", "Foreign"), denied);
  const view = await openDevCourse(student, "dh-test-own");
  assert.equal(view?.modules.some((module) => module.lessons.some((item) => item.id === own.hiddenId)), false);
  assert.equal(await openDevLesson(student, "dh-test-own", own.hiddenId), null);
});

test("dev host progress persistence", async () => {
  const slug = "dh-test-progress";
  const course = await build(slug);
  assert.equal(await enrollDevStudent(student, slug), true);
  assert.equal(await completeDevLesson(student, slug, course.visibleId), true);
  const first = await openDevCourse(student, slug);
  assert.equal(first?.percent, 100);
  const fresh = openDb();
  try {
    const again = await openDevCourse(student, slug, fresh);
    assert.equal(again?.completed, 1);
    assert.equal(again?.percent, 100);
  } finally {
    await fresh.$disconnect();
  }
});

test("dev host media access", async () => {
  const slug = "dh-test-media";
  const course = await build(slug);
  const file = new File(["dev-host asset"], "note.txt", { type: "text/plain" });
  await addDevAsset(admin, course.courseId, course.visibleId, file);
  const asset = await getDb().lessonAsset.findFirstOrThrow({ where: { itemId: course.visibleId }, select: { id: true } });
  assert.equal(await readDevAsset(null, asset.id), null);
  assert.equal(await readDevAsset(student, asset.id), null);
  assert.equal(await enrollDevStudent(student, slug), true);
  const allowed = await readDevAsset(student, asset.id);
  assert.equal(allowed?.name, "note.txt");
  const instructorRead = await readDevAsset(instructor, asset.id);
  assert.equal(instructorRead?.name, "note.txt");
});
