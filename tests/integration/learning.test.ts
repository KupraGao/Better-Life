import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { parseEnv } from "node:util";
import pg from "pg";
import { db } from "../../src/lib/db";
import { completeLesson, enrollForFree, listCourses, myCourses, progressPercent, readCourse, readLesson } from "../../src/modules/learning/service";

const fileEnv = parseEnv(readFileSync(".env", "utf8"));
if (!process.env.DATABASE_URL && fileEnv.DATABASE_URL) process.env.DATABASE_URL = fileEnv.DATABASE_URL;
const runtimeUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
const localEnv = parseEnv(readFileSync(".local/db/env", "utf8"));
const localUrl = new URL(localEnv.DATABASE_URL);
const adminUrl = new URL(localEnv.DB_ADMIN_URL);
assert.equal(runtimeUrl.hostname, "127.0.0.1");
assert.equal(runtimeUrl.port, "55432");
assert.equal(runtimeUrl.pathname, "/betterlife");
assert.equal(localUrl.hostname, runtimeUrl.hostname);
assert.equal(localUrl.port, runtimeUrl.port);
assert.equal(localUrl.pathname, runtimeUrl.pathname);
assert.equal(adminUrl.hostname, "127.0.0.1");
assert.equal(adminUrl.port, "55432");

const suiteLock = new pg.Client({
  host: "127.0.0.1", port: 55432, database: "betterlife",
  user: adminUrl.username, password: adminUrl.password,
});
await suiteLock.connect();
await suiteLock.query("SELECT pg_advisory_lock(1842001)");
after(async () => {
  try {
    await suiteLock.query("SELECT pg_advisory_unlock(1842001)");
  } finally {
    await suiteLock.end();
    await db.$disconnect();
  }
});

test("published content, enrollment and progress are scoped to the course and learner", async () => {
  assert.equal(progressPercent(0, 0), 0);
  assert.equal(progressPercent(0, 4), 0);
  assert.equal(progressPercent(1, 3), 33);
  assert.equal(progressPercent(199, 200), 99);
  assert.equal(progressPercent(2, 2), 100);
  assert.equal(progressPercent(-1, 2), 0);
  const rollback = new Error("discard test fixtures");
  await assert.rejects(db.$transaction(async (tx) => {
    const learner = randomUUID();
    const other = randomUUID();
    await tx.appUser.createMany({ data: [
      { id: learner, displayName: "First student" }, { id: other, displayName: "Second student" }
    ] });
    const translations = (title: string) => ({ create: [
      { locale: "ka", title, description: { blocks: [] } },
      { locale: "en", title, description: { blocks: [] } }
    ] });
    const course = await tx.course.create({ data: {
      slug: `learning-test-${randomUUID()}`, published: true, freeEnrollment: true, translations: translations("Learning")
    } });
    const invite = await tx.course.create({ data: {
      slug: `invited-test-${randomUUID()}`, published: true, translations: translations("Assigned")
    } });
    const courseModule = await tx.module.create({ data: { courseId: course.id, position: 1, titles: { ka: "ძირითადი", en: "Basics" } } });
    async function addLesson(position: number, preview: boolean, published: boolean) {
      return tx.learningItem.create({ data: {
        moduleId: courseModule.id, position, preview, published,
        translations: { create: ["ka", "en"].map((locale) => ({
          locale, title: `Lesson ${position}`, body: { blocks: [{ type: "paragraph", text: `private body ${position}` }] }
        })) }
      } });
    }
    const preview = await addLesson(1, true, true);
    const privateLesson = await addLesson(2, false, true);
    const draft = await addLesson(3, true, false);
    const before = await readCourse(tx, "en", course.slug, null);
    assert.ok(before);
    assert.equal(before.total, 2);
    assert.equal(before.modules[0].lessons[0].accessible, false);
    assert.equal(before.modules[0].lessons[1].accessible, false);
    assert.ok(!JSON.stringify(before).includes("private body"));
    assert.equal(await readLesson(tx, "ka", course.slug, preview.id, null), null);
    assert.equal(await readLesson(tx, "ka", course.slug, privateLesson.id, null), null);
    assert.equal(await completeLesson(tx, "ka", course.slug, preview.id, other), false);

    assert.equal(await enrollForFree(tx, "ka", invite.slug, learner), false);
    assert.equal(await enrollForFree(tx, "ka", course.slug, learner), true);
    assert.equal(await enrollForFree(tx, "ka", course.slug, learner), true);
    assert.equal(await tx.enrollment.count({ where: { userId: learner, courseId: course.id } }), 1);
    assert.ok(await readLesson(tx, "en", course.slug, privateLesson.id, learner));
    assert.equal(await readLesson(tx, "en", course.slug, privateLesson.id, other), null);
    assert.equal(await readLesson(tx, "en", course.slug, draft.id, learner), null);
    assert.equal(await readLesson(tx, "en", invite.slug, privateLesson.id, learner), null);
    assert.equal(await readLesson(tx, "en", course.slug, "invalid", learner), null);
    assert.deepEqual(await myCourses(tx, "en", other), []);
    assert.equal(await completeLesson(tx, "en", course.slug, draft.id, learner), false);
    assert.equal(await completeLesson(tx, "en", course.slug, privateLesson.id, other), false);

    await tx.learningItem.update({ where: { id: preview.id }, data: { releaseAt: new Date(Date.now() + 86_400_000) } });
    assert.equal(await readLesson(tx, "en", course.slug, preview.id, null), null);
    assert.equal(await completeLesson(tx, "ka", course.slug, preview.id, learner), false);
    await tx.learningItem.update({ where: { id: preview.id }, data: { releaseAt: null } });
    assert.ok(await completeLesson(tx, "ka", course.slug, preview.id, learner));
    const halfway = await readCourse(tx, "ka", course.slug, learner);
    assert.equal(halfway?.completed, 1);
    assert.equal(halfway?.total, 2);
    assert.equal(halfway?.percent, 50);
    assert.equal(halfway?.finished, false);
    const enrollment = { userId_courseId: { userId: learner, courseId: course.id } };
    assert.equal((await tx.enrollment.findUniqueOrThrow({ where: enrollment })).completedAt, null);
    assert.ok(await completeLesson(tx, "en", course.slug, privateLesson.id, learner));
    const first = await tx.enrollment.findUniqueOrThrow({ where: enrollment });
    assert.ok(first.completedAt);
    assert.ok(await completeLesson(tx, "ka", course.slug, privateLesson.id, learner));
    assert.equal((await tx.enrollment.findUniqueOrThrow({ where: enrollment })).completedAt?.getTime(), first.completedAt.getTime());
    assert.equal(await tx.progress.count({ where: { userId: learner } }), 2);
    assert.deepEqual((await myCourses(tx, "ka", learner)).map((entry) => [entry.completed, entry.total, entry.percent, entry.finished]), [[2, 2, 100, true]]);
    assert.equal((await readCourse(tx, "ka", course.slug, other))?.completed, 0);

    const hidden = await tx.course.create({ data: {
      slug: `hidden-test-${randomUUID()}`, published: true, freeEnrollment: true, translations: translations("Hidden"),
    } });
    const hiddenModule = await tx.module.create({ data: { courseId: hidden.id, position: 1, titles: { ka: "დაფარული", en: "Hidden" } } });
    await tx.learningItem.create({ data: {
      moduleId: hiddenModule.id, position: 1, published: false, preview: true,
      translations: { create: ["ka", "en"].map((locale) => ({
        locale, title: "Draft lesson", body: { blocks: [] },
      })) },
    } });
    assert.equal(await readCourse(tx, "en", hidden.slug, learner), null);
    assert.equal(await readCourse(tx, "ka", hidden.slug, null), null);
    assert.ok(!(await listCourses(tx, "en")).some((entry) => entry.slug === hidden.slug));
    assert.ok(!(await listCourses(tx, "ka")).some((entry) => entry.slug === hidden.slug));
    assert.equal(await enrollForFree(tx, "ka", hidden.slug, learner), false);

    // A published lesson that exists only in Georgian stays out of the English course.
    const georgianOnly = await tx.learningItem.create({ data: { moduleId: courseModule.id, position: 4, published: true,
      translations: { create: { locale: "ka", title: "ახალი", body: { blocks: [] } } } } });
    const englishCourse = await readCourse(tx, "en", course.slug, learner);
    assert.ok(englishCourse);
    assert.equal(englishCourse.total, 2);
    assert.equal(englishCourse.completed, 2);
    assert.equal(englishCourse.percent, 100);
    assert.equal(englishCourse.finished, true);
    assert.ok(!englishCourse.modules.some((row) => row.lessons.some((lesson) => lesson.id === georgianOnly.id)));
    assert.ok(await readLesson(tx, "en", course.slug, privateLesson.id, learner));
    assert.equal(await readLesson(tx, "en", course.slug, georgianOnly.id, learner), null);
    const englishListing = (await listCourses(tx, "en")).find((entry) => entry.slug === course.slug);
    assert.ok(englishListing);
    assert.equal(englishListing.total, 2);
    const extended = await readCourse(tx, "ka", course.slug, learner);
    assert.equal(extended?.completed, 2);
    assert.equal(extended?.total, 3);
    assert.equal(extended?.percent, 66);
    assert.equal(extended?.finished, false);
    assert.equal(await tx.progress.count({ where: { userId: learner } }), 2);
    await tx.course.update({ where: { id: course.id }, data: { archivedAt: new Date() } });
    assert.equal(await readLesson(tx, "ka", course.slug, preview.id, learner), null);
    assert.equal(await enrollForFree(tx, "ka", course.slug, other), false);
    assert.deepEqual(await myCourses(tx, "ka", learner), []);
    assert.equal(await tx.progress.count({ where: { userId: learner } }), 2);
    assert.equal(await tx.learningItem.count({ where: { id: georgianOnly.id } }), 1);
    throw rollback;
  }, { isolationLevel: "Serializable", timeout: 60_000 }), (error: unknown) => error === rollback);
});
