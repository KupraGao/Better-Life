import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { parseEnv } from "node:util";
import pg from "pg";
import { assetFailure, detectAsset, maxAssetSize } from "../../src/modules/media/file-type";

function localUrl(value: string) {
  const url = new URL(value);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55432");
  assert.equal(url.pathname, "/betterlife");
  assert.equal(url.searchParams.has("host") || url.searchParams.has("port") || url.searchParams.has("hostaddr"), false);
  return url;
}

const env = parseEnv(await readFile(".local/db/env", "utf8"));
localUrl(env.DATABASE_URL);
const adminUrl = localUrl(env.DB_ADMIN_URL);
process.env.DATABASE_URL = env.DATABASE_URL;

const { db } = await import("../../src/lib/db");
const { EditorError, createCourse, mutateCourse } = await import("../../src/modules/catalog/manage");
const { readAsset } = await import("../../src/modules/media/read-asset");

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

const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
const textBytes = new TextEncoder().encode("სასწავლო მასალა\n");
const pdfBytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");

function file(bytes: Uint8Array, name: string) {
  return new File([bytes], name);
}

function fields(values: Record<string, string | File>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

async function expectCode(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run(), (error: unknown) => {
    assert.ok(error instanceof EditorError);
    assert.equal(error.code, code);
    return true;
  });
}

test("assetFailure separates an empty file, a file over 768 KiB, and an unsupported type", () => {
  assert.equal(assetFailure(new Uint8Array(), "empty.png"), "empty");
  assert.equal(detectAsset(new Uint8Array(), "empty.png"), null);

  const oversize = new Uint8Array(maxAssetSize + 1);
  oversize.set(pngBytes.subarray(0, 8), 0);
  assert.equal(assetFailure(oversize, "huge.png"), "size");
  assert.equal(detectAsset(oversize, "huge.png"), null);

  const clip = Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112]);
  assert.equal(assetFailure(clip, "clip.mp4"), "type");
  assert.equal(detectAsset(clip, "clip.mp4"), null);

  assert.equal(assetFailure(pngBytes, "diagram.png"), null);
  assert.deepEqual(detectAsset(pngBytes, "diagram.png"), { mimeType: "image/png", kind: "IMAGE" });

  const boundary = new Uint8Array(maxAssetSize);
  boundary.set(pngBytes.subarray(0, 8), 0);
  assert.equal(assetFailure(boundary, "limit.png"), null);
  assert.deepEqual(detectAsset(boundary, "limit.png"), { mimeType: "image/png", kind: "IMAGE" });
});

function encoded(data: Uint8Array) {
  return Buffer.from(data).toString("base64");
}

test("lesson files can be replaced or deleted only by that course's editors", async () => {
  const admin = new pg.Client({
    host: "127.0.0.1", port: 55432, database: "betterlife",
    user: adminUrl.username, password: adminUrl.password,
  });
  const adminId = randomUUID();
  const instructorId = randomUUID();
  const otherInstructorId = randomUUID();
  const studentId = randomUUID();
  const slug = `asset-${randomUUID()}`;
  const otherSlug = `asset-other-${randomUUID()}`;
  const slugs = [slug, otherSlug];
  const users = [adminId, instructorId, otherInstructorId, studentId];
  await admin.connect();
  const before = await admin.query(`SELECT
    (SELECT count(*) FROM app."LessonAsset")::int AS assets,
    (SELECT count(*) FROM app."Course")::int AS courses,
    (SELECT count(*) FROM app."LearningItem")::int AS items,
    (SELECT count(*) FROM app."Progress")::int AS progress`);
  try {
    await admin.query(
      `INSERT INTO app."AppUser"(id, "displayName", role) VALUES
        ($1::uuid, 'Asset admin', 'ADMIN'::app."Role"),
        ($2::uuid, 'Asset instructor', 'INSTRUCTOR'::app."Role"),
        ($3::uuid, 'Other instructor', 'INSTRUCTOR'::app."Role"),
        ($4::uuid, 'Asset student', 'STUDENT'::app."Role")`,
      users,
    );
    const courseForm = new FormData();
    courseForm.set("title", "მასალების კურსი");
    courseForm.set("slug", slug);
    courseForm.set("body", "აღწერა");
    const course = await createCourse(adminId, courseForm);
    const otherForm = new FormData();
    otherForm.set("title", "სხვა კურსი");
    otherForm.set("slug", otherSlug);
    otherForm.set("body", "");
    const otherCourse = await createCourse(adminId, otherForm);

    const assign = new FormData();
    assign.set("userId", instructorId);
    await mutateCourse(adminId, course.id, "assign", "ka", assign);
    const enroll = new FormData();
    enroll.set("userId", studentId);
    await mutateCourse(adminId, course.id, "enroll", "ka", enroll);

    async function addLesson(courseId: string, title: string) {
      const existing = await db.module.findFirst({ where: { courseId, archivedAt: null }, select: { id: true } });
      let moduleId = existing?.id;
      if (!moduleId) {
        await mutateCourse(adminId, courseId, "module-new", "ka", fields({ title: "მოდული" }));
        moduleId = (await db.module.findFirstOrThrow({ where: { courseId }, select: { id: true } })).id;
      }
      await mutateCourse(adminId, courseId, "lesson-new", "ka", fields({ target: moduleId, title, body: "საწყისი ტექსტი" }));
      return db.learningItem.findFirstOrThrow({
        where: { moduleId, translations: { some: { locale: "ka", title } } },
        select: { id: true },
      });
    }

    const lesson = await addLesson(course.id, "გაკვეთილი");
    const neighbor = await addLesson(course.id, "მეზობელი");
    const foreignLesson = await addLesson(otherCourse.id, "სხვისი გაკვეთილი");
    await mutateCourse(adminId, course.id, "lesson-edit", "ka", fields({
      target: lesson.id, title: "გაკვეთილი", body: "საწყისი ტექსტი", video: "", published: "on",
    }));
    await mutateCourse(adminId, course.id, "publish", "ka", new FormData());
    await db.progress.create({ data: { userId: studentId, itemId: lesson.id, positionSec: 15 } });

    await mutateCourse(adminId, course.id, "asset", "ka", fields({ target: lesson.id, file: file(pngBytes, "diagram.png") }));
    await mutateCourse(adminId, course.id, "asset", "ka", fields({ target: lesson.id, file: file(textBytes, "notes.txt") }));
    await mutateCourse(adminId, course.id, "asset", "ka", fields({ target: neighbor.id, file: file(pngBytes, "neighbor.png") }));
    await mutateCourse(adminId, otherCourse.id, "asset", "ka", fields({ target: foreignLesson.id, file: file(pngBytes, "foreign.png") }));

    const main = await db.lessonAsset.findFirstOrThrow({ where: { itemId: lesson.id, name: "diagram.png" } });
    const sibling = await db.lessonAsset.findFirstOrThrow({ where: { itemId: lesson.id, name: "notes.txt" } });
    const neighborAsset = await db.lessonAsset.findFirstOrThrow({ where: { itemId: neighbor.id, name: "neighbor.png" } });
    const foreign = await db.lessonAsset.findFirstOrThrow({ where: { itemId: foreignLesson.id, name: "foreign.png" } });
    const original = encoded(main.data);
    const originalKey = main.objectKey;

    async function lessonFacts(id: string) {
      const row = await db.learningItem.findUniqueOrThrow({
        where: { id },
        select: {
          published: true, videoSource: true, videoRef: true,
          translations: { where: { locale: "ka" }, select: { title: true, body: true } },
          progress: { select: { userId: true, positionSec: true } },
        },
      });
      return {
        published: row.published,
        videoSource: row.videoSource,
        videoRef: row.videoRef,
        title: row.translations[0]?.title ?? "",
        body: row.translations[0]?.body ?? null,
        progress: row.progress,
      };
    }

    const facts = await lessonFacts(lesson.id);
    const published = (await db.course.findUniqueOrThrow({ where: { id: course.id }, select: { published: true } })).published;
    assert.equal(published, true);

    const deniedActors = [
      [studentId, course.id],
      [otherInstructorId, course.id],
      [instructorId, otherCourse.id],
    ] as const;
    for (const [actorId, courseId] of deniedActors) {
      const assetId = courseId === course.id ? main.id : foreign.id;
      const itemId = courseId === course.id ? lesson.id : foreignLesson.id;
      await expectCode(() => mutateCourse(actorId, courseId, "asset-delete", "ka", fields({ target: itemId, asset: assetId })), "denied");
      await expectCode(() => mutateCourse(actorId, courseId, "asset-replace", "ka", fields({
        target: itemId, asset: assetId, file: file(pdfBytes, "guide.pdf"),
      })), "denied");
    }
    await expectCode(() => mutateCourse(instructorId, course.id, "asset-delete", "ka", fields({ target: lesson.id, asset: foreign.id })), "denied");
    await expectCode(() => mutateCourse(instructorId, course.id, "asset-replace", "ka", fields({
      target: lesson.id, asset: foreign.id, file: file(pdfBytes, "guide.pdf"),
    })), "denied");
    await expectCode(() => mutateCourse(instructorId, course.id, "asset-delete", "ka", fields({ target: neighbor.id, asset: main.id })), "denied");

    const video = new Uint8Array(maxAssetSize + 1);
    video.set(pngBytes.subarray(0, 8), 0);
    await expectCode(() => mutateCourse(instructorId, course.id, "asset-replace", "ka", fields({
      target: lesson.id, asset: main.id, file: file(Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112]), "clip.mp4"),
    })), "file");
    await expectCode(() => mutateCourse(instructorId, course.id, "asset-replace", "ka", fields({
      target: lesson.id, asset: main.id, file: file(video, "huge.png"),
    })), "file-size");

    const unchanged = await db.lessonAsset.findUniqueOrThrow({ where: { id: main.id } });
    assert.equal(unchanged.name, "diagram.png");
    assert.equal(unchanged.objectKey, originalKey);
    assert.equal(encoded(unchanged.data), original);
    assert.equal(encoded((await db.lessonAsset.findUniqueOrThrow({ where: { id: foreign.id } })).data), encoded(pngBytes));
    assert.equal(await db.lessonAsset.count({ where: { id: sibling.id } }), 1);

    await mutateCourse(instructorId, course.id, "asset-replace", "ka", fields({
      target: lesson.id, asset: main.id, file: file(pdfBytes, "guide.pdf"),
    }));
    const replaced = await db.lessonAsset.findUniqueOrThrow({ where: { id: main.id } });
    assert.equal(replaced.id, main.id);
    assert.equal(replaced.itemId, lesson.id);
    assert.equal(replaced.objectKey, originalKey);
    assert.equal(replaced.name, "guide.pdf");
    assert.equal(replaced.mimeType, "application/pdf");
    assert.equal(replaced.kind, "ATTACHMENT");
    assert.equal(replaced.sizeBytes, pdfBytes.length);
    assert.equal(encoded(replaced.data), encoded(pdfBytes));
    const viewed = await db.$transaction((tx) => readAsset(tx, main.id, "ka", { id: studentId, role: "STUDENT" }));
    assert.equal(viewed?.name, "guide.pdf");
    assert.equal(encoded(viewed?.data ?? new Uint8Array()), encoded(pdfBytes));
    assert.deepEqual(await lessonFacts(lesson.id), facts);
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: course.id }, select: { published: true } })).published, true);
    assert.equal((await db.lessonAsset.findUniqueOrThrow({ where: { id: neighborAsset.id } })).name, "neighbor.png");

    await mutateCourse(instructorId, course.id, "asset-delete", "ka", fields({ target: lesson.id, asset: sibling.id }));
    assert.equal(await db.lessonAsset.count({ where: { id: sibling.id } }), 0);
    assert.equal(await db.lessonAsset.count({ where: { id: main.id } }), 1);
    await mutateCourse(adminId, otherCourse.id, "asset-replace", "ka", fields({
      target: foreignLesson.id, asset: foreign.id, file: file(textBytes, "foreign.txt"),
    }));
    const adminReplaced = await db.lessonAsset.findUniqueOrThrow({ where: { id: foreign.id } });
    assert.equal(adminReplaced.name, "foreign.txt");
    assert.equal(adminReplaced.mimeType, "text/plain; charset=utf-8");
    assert.equal(encoded(adminReplaced.data), encoded(textBytes));
    await mutateCourse(adminId, otherCourse.id, "asset-delete", "ka", fields({ target: foreignLesson.id, asset: foreign.id }));
    await mutateCourse(adminId, course.id, "asset-delete", "ka", fields({ target: lesson.id, asset: main.id }));
    assert.equal(await db.lessonAsset.count({ where: { id: { in: [main.id, sibling.id, foreign.id] } } }), 0);
    assert.equal(await db.lessonAsset.count({ where: { id: neighborAsset.id } }), 1);
    assert.equal(await db.$transaction((tx) => readAsset(tx, main.id, "ka", { id: studentId, role: "STUDENT" })), null);
    assert.deepEqual(await lessonFacts(lesson.id), facts);
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: course.id }, select: { published: true } })).published, true);
  } finally {
    try {
      const itemIds = `(SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
        WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[])))`;
      await admin.query(`DELETE FROM app."Progress" WHERE "itemId" IN ${itemIds} OR "userId" = ANY($2::uuid[])`, [slugs, users]);
      await admin.query(`DELETE FROM app."LessonAsset" WHERE "itemId" IN ${itemIds}`, [slugs]);
      await admin.query(`DELETE FROM app."ItemTranslation" WHERE "itemId" IN ${itemIds}`, [slugs]);
      await admin.query(`DELETE FROM app."LearningItem" WHERE "moduleId" IN (
        SELECT id FROM app."Module" WHERE "courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))
      )`, [slugs]);
      await admin.query(`DELETE FROM app."Module" WHERE "courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))`, [slugs]);
      await admin.query(`DELETE FROM app."Enrollment" WHERE "userId" = ANY($1::uuid[]) OR "courseId" IN (
        SELECT id FROM app."Course" WHERE slug = ANY($2::text[])
      )`, [users, slugs]);
      await admin.query(`DELETE FROM app."CourseInstructor" WHERE "userId" = ANY($1::uuid[]) OR "courseId" IN (
        SELECT id FROM app."Course" WHERE slug = ANY($2::text[])
      )`, [users, slugs]);
      await admin.query(`DELETE FROM app."CourseSlugAlias" WHERE slug = ANY($1::text[]) OR "courseId" IN (
        SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
      )`, [slugs]);
      await admin.query(`DELETE FROM app."CourseTranslation" WHERE "courseId" IN (
        SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
      )`, [slugs]);
      await admin.query(`DELETE FROM app."Course" WHERE slug = ANY($1::text[])`, [slugs]);
      await admin.query(`DELETE FROM app."AppUser" WHERE id = ANY($1::uuid[])`, [users]);
      const after = await admin.query(`SELECT
        (SELECT count(*) FROM app."LessonAsset")::int AS assets,
        (SELECT count(*) FROM app."Course")::int AS courses,
        (SELECT count(*) FROM app."LearningItem")::int AS items,
        (SELECT count(*) FROM app."Progress")::int AS progress`);
      assert.deepEqual(after.rows[0], before.rows[0]);
    } finally {
      await admin.end();
    }
  }
});
