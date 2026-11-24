import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { parseEnv } from "node:util";
import pg from "pg";

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
const { EditorError, accessStampFrom, basicsStampFrom, createCourse, mutateCategory, mutateCourse, planStampFrom, saveCourseAccess, saveCourseBasics, saveCoursePlan } = await import("../../src/modules/catalog/manage");

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

function fields(values: Record<string, string | string[]>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) for (const item of value) form.append(key, item);
    else form.set(key, value);
  }
  return form;
}

function rejected(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof EditorError);
    assert.equal(error.code, code);
    return true;
  };
}

test("basics save writes every field together and rolls back on an invalid cover", async () => {
  const admin = new pg.Client({
    host: "127.0.0.1", port: 55432, database: "betterlife",
    user: adminUrl.username, password: adminUrl.password,
  });
  const adminId = randomUUID();
  const instructorId = randomUUID();
  const otherInstructorId = randomUUID();
  const studentId = randomUUID();
  const slug = `editor-${randomUUID()}`;
  const renamed = `editor-renamed-${randomUUID()}`;
  const categorySlug = `editor-cat-${randomUUID()}`;
  const users = [adminId, instructorId, otherInstructorId, studentId];
  await admin.connect();
  const before = await admin.query(`SELECT
    (SELECT count(*) FROM app."Course")::int AS courses,
    (SELECT count(*) FROM app."Category")::int AS categories,
    (SELECT count(*) FROM app."Progress")::int AS progress`);
  try {
    await admin.query(
      `INSERT INTO app."AppUser"(id, "displayName", role) VALUES
        ($1::uuid, 'Editor admin', 'ADMIN'::app."Role"),
        ($2::uuid, 'Editor instructor', 'INSTRUCTOR'::app."Role"),
        ($3::uuid, 'Other editor', 'INSTRUCTOR'::app."Role"),
        ($4::uuid, 'Editor student', 'STUDENT'::app."Role")`,
      users,
    );
    await mutateCategory(adminId, "category-new", fields({ title: "კატეგორია", titleEn: "Category", slug: categorySlug }));
    const category = await db.category.findUniqueOrThrow({ where: { slug: categorySlug }, select: { id: true } });
    const created = await createCourse(adminId, fields({ title: "საწყისი", slug, body: "ძველი" }));
    await mutateCourse(adminId, created.id, "assign", "ka", fields({ userId: instructorId }));
    await mutateCourse(adminId, created.id, "module-new", "ka", fields({ title: "მოდული" }));
    const courseModule = await db.module.findFirstOrThrow({ where: { courseId: created.id }, select: { id: true } });
    await mutateCourse(adminId, created.id, "lesson-new", "ka", fields({
      target: courseModule.id, title: "გაკვეთილი", body: "ტექსტი",
    }));
    const lesson = await db.learningItem.findFirstOrThrow({ where: { moduleId: courseModule.id }, select: { id: true } });
    await db.progress.create({ data: { userId: studentId, itemId: lesson.id, positionSec: 9 } });

    const bad = fields({
      title: "არ უნდა შეინახოს", body: "ახალი", slug: renamed, cover: "http://cdn.example.com/a.jpg",
      level: "BEGINNER", category: [category.id],
    });
    await assert.rejects(saveCourseBasics(instructorId, created.id, "ka", await withBasicsStamp(created.id, bad)), rejected("cover"));
    const unchanged = await db.course.findUniqueOrThrow({
      where: { id: created.id },
      select: { slug: true, coverImage: true, translations: { where: { locale: "ka" }, select: { title: true } } },
    });
    assert.equal(unchanged.slug, slug);
    assert.equal(unchanged.coverImage, null);
    assert.equal(unchanged.translations[0]?.title, "საწყისი");

    await assert.rejects(saveCourseBasics(studentId, created.id, "ka", fields({
      title: "სტუდენტი", body: "", slug, cover: "", level: "",
    })), rejected("denied"));
    await assert.rejects(saveCourseBasics(otherInstructorId, created.id, "ka", fields({
      title: "სხვისი", body: "", slug, cover: "", level: "",
    })), rejected("denied"));

    await saveCourseBasics(instructorId, created.id, "ka", await withBasicsStamp(created.id, fields({
      title: "განახლებული", body: "## თავი\nაბზაცი", slug: renamed, cover: "https://cdn.example.com/cover.jpg",
      level: "ADVANCED", category: [category.id],
    })));
    const saved = await db.course.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        slug: true, coverImage: true, level: true,
        translations: { where: { locale: "ka" }, select: { title: true, description: true } },
        categories: { select: { categoryId: true } },
      },
    });
    assert.equal(saved.slug, renamed);
    assert.equal(saved.coverImage, "https://cdn.example.com/cover.jpg");
    assert.equal(saved.level, "ADVANCED");
    assert.equal(saved.translations[0]?.title, "განახლებული");
    assert.deepEqual(saved.categories, [{ categoryId: category.id }]);
    const lessonAfter = await db.learningItem.findUniqueOrThrow({
      where: { id: lesson.id },
      select: { translations: { where: { locale: "ka" }, select: { title: true } }, progress: { select: { positionSec: true } } },
    });
    assert.equal(lessonAfter.translations[0]?.title, "გაკვეთილი");
    assert.deepEqual(lessonAfter.progress, [{ positionSec: 9 }]);

    await assert.rejects(saveCourseAccess(instructorId, created.id, fields({
      mode: "free", priceRegular: "", priceSale: "",
    })), rejected("denied"));
    const priced = await withAccessStamp(created.id, fields({ mode: "paid", priceRegular: "240", priceSale: "240" }));
    await assert.rejects(saveCourseAccess(adminId, created.id, priced), rejected("price"));
    const stillClosed = await db.course.findUniqueOrThrow({
      where: { id: created.id },
      select: { freeEnrollment: true, listed: true, priceRegular: true, priceSale: true },
    });
    assert.deepEqual(stillClosed, { freeEnrollment: false, listed: true, priceRegular: null, priceSale: null });
    await saveCourseAccess(adminId, created.id, await withAccessStamp(created.id, fields({
      mode: "paid", priceRegular: "240", priceSale: "160", listed: "on",
    })));
    const paid = await db.course.findUniqueOrThrow({
      where: { id: created.id },
      select: { freeEnrollment: true, listed: true, priceRegular: true, priceSale: true, translations: { where: { locale: "ka" }, select: { title: true } } },
    });
    assert.equal(paid.freeEnrollment, false);
    assert.equal(paid.listed, true);
    assert.equal(paid.priceRegular, 24000);
    assert.equal(paid.priceSale, 16000);
    assert.equal(paid.translations[0]?.title, "განახლებული");
  } finally {
    const slugs = [slug, renamed];
    await admin.query(`DELETE FROM app."Progress" WHERE "userId" = ANY($1::uuid[]) OR "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($2::text[]))
    )`, [users, slugs]);
    await admin.query(`DELETE FROM app."LessonAsset" WHERE "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))
    )`, [slugs]);
    await admin.query(`DELETE FROM app."ItemTranslation" WHERE "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))
    )`, [slugs]);
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
    await admin.query(`DELETE FROM app."CourseCategory" WHERE "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
    ) OR "categoryId" IN (SELECT id FROM app."Category" WHERE slug = $2)`, [slugs, categorySlug]);
    await admin.query(`DELETE FROM app."CourseSlugAlias" WHERE slug = ANY($1::text[]) OR "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
    )`, [slugs]);
    await admin.query(`DELETE FROM app."CourseTranslation" WHERE "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
    )`, [slugs]);
    await admin.query(`DELETE FROM app."Course" WHERE slug = ANY($1::text[])`, [slugs]);
    await admin.query(`DELETE FROM app."CategoryTranslation" WHERE "categoryId" IN (
      SELECT id FROM app."Category" WHERE slug = $1
    )`, [categorySlug]);
    await admin.query(`DELETE FROM app."Category" WHERE slug = $1`, [categorySlug]);
    await admin.query(`DELETE FROM app."AppUser" WHERE id = ANY($1::uuid[])`, [users]);
    const after = await admin.query(`SELECT
      (SELECT count(*) FROM app."Course")::int AS courses,
      (SELECT count(*) FROM app."Category")::int AS categories,
      (SELECT count(*) FROM app."Progress")::int AS progress`);
    assert.deepEqual(after.rows[0], before.rows[0]);
    await admin.end();
  }
});

const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
const pdfBytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");

function planFile(bytes: Uint8Array, name: string) {
  return new File([bytes], name);
}

async function withBasicsStamp(courseId: string, form: FormData) {
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: {
      slug: true, coverImage: true, level: true,
      categories: { select: { categoryId: true } },
      translations: { select: { locale: true, title: true, description: true } },
    },
  });
  form.set("stamp", basicsStampFrom(course));
  return form;
}

async function withAccessStamp(courseId: string, form: FormData) {
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { freeEnrollment: true, listed: true, priceRegular: true, priceSale: true },
  });
  form.set("stamp", accessStampFrom(course));
  return form;
}

async function planPayload(courseId: string, modules: unknown, files: Record<string, File> = {}) {
  const loaded = await db.module.findMany({
    where: { courseId, archivedAt: null },
    orderBy: { position: "asc" },
    select: {
      id: true, titles: true,
      items: {
        where: { kind: "LESSON", archivedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true, published: true, videoSource: true, videoRef: true,
          translations: { select: { locale: true, title: true, body: true } },
          assets: { select: { id: true } },
        },
      },
    },
  });
  const form = new FormData();
  form.set("stamp", planStampFrom(loaded));
  form.set("plan", JSON.stringify({ modules }));
  for (const [key, file] of Object.entries(files)) form.set(`file:${key}`, file);
  return form;
}

test("plan save writes structure, order, and files together and rolls back on failure", async () => {
  const admin = new pg.Client({
    host: "127.0.0.1", port: 55432, database: "betterlife",
    user: adminUrl.username, password: adminUrl.password,
  });
  const adminId = randomUUID();
  const instructorId = randomUUID();
  const otherInstructorId = randomUUID();
  const studentId = randomUUID();
  const slug = `plan-${randomUUID()}`;
  const users = [adminId, instructorId, otherInstructorId, studentId];
  await admin.connect();
  const before = await admin.query(`SELECT
    (SELECT count(*) FROM app."Course")::int AS courses,
    (SELECT count(*) FROM app."LearningItem")::int AS items,
    (SELECT count(*) FROM app."LessonAsset")::int AS assets,
    (SELECT count(*) FROM app."Progress")::int AS progress`);
  try {
    await admin.query(
      `INSERT INTO app."AppUser"(id, "displayName", role) VALUES
        ($1::uuid, 'Plan admin', 'ADMIN'::app."Role"),
        ($2::uuid, 'Plan instructor', 'INSTRUCTOR'::app."Role"),
        ($3::uuid, 'Other plan editor', 'INSTRUCTOR'::app."Role"),
        ($4::uuid, 'Plan student', 'STUDENT'::app."Role")`,
      users,
    );
    const created = await createCourse(adminId, fields({ title: "საწყისი", slug, body: "ძველი" }));
    await mutateCourse(adminId, created.id, "assign", "ka", fields({ userId: instructorId }));
    await mutateCourse(adminId, created.id, "module-new", "ka", fields({ title: "მოდული" }));
    const courseModule = await db.module.findFirstOrThrow({ where: { courseId: created.id }, select: { id: true, position: true } });
    await mutateCourse(adminId, created.id, "lesson-new", "ka", fields({
      target: courseModule.id, title: "გაკვეთილი", body: "ტექსტი",
    }));
    const lesson = await db.learningItem.findFirstOrThrow({
      where: { moduleId: courseModule.id, kind: "LESSON" },
      select: { id: true, position: true, published: true, preview: true },
    });
    await mutateCourse(adminId, created.id, "asset", "ka", fields({
      target: lesson.id, file: planFile(pngBytes, "diagram.png"),
    }));
    const asset = await db.lessonAsset.findFirstOrThrow({ where: { itemId: lesson.id }, select: { id: true, objectKey: true } });
    const quiz = await db.learningItem.create({
      data: { moduleId: courseModule.id, kind: "QUIZ", position: lesson.position + 1, published: false },
      select: { id: true, position: true },
    });
    await db.progress.create({ data: { userId: studentId, itemId: lesson.id, positionSec: 9 } });
    const kept = {
      key: courseModule.id, id: courseModule.id, title: "მოდული",
      lessons: [{
        key: lesson.id, id: lesson.id, title: "გაკვეთილი", body: "ტექსტი", video: "",
        assets: [{ key: asset.id, id: asset.id, action: "keep" }],
      }],
    };
    await assert.rejects(saveCoursePlan(instructorId, created.id, "ka", await planPayload(created.id, [{
      ...kept, title: "არ შეინახოს",
      lessons: [{ ...kept.lessons[0], title: "არა", video: "http://evil.test/v" }],
    }])), rejected("video"));
    await assert.rejects(saveCoursePlan(instructorId, created.id, "ka", await planPayload(created.id, [{
      ...kept, lessons: [{ ...kept.lessons[0], assets: [] }],
    }])), rejected("stale"));
    const broken = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    await assert.rejects(saveCoursePlan(instructorId, created.id, "ka", await planPayload(created.id, [{
      ...kept, lessons: [{ ...kept.lessons[0], title: "ფაილი ვერ უნდა", assets: [{ key: asset.id, id: asset.id, action: "replace" }] }],
    }], { [asset.id]: planFile(broken, "clip.mp4") })), rejected("file"));
    await assert.rejects(saveCoursePlan(studentId, created.id, "ka", await planPayload(created.id, [kept])), rejected("denied"));
    const forged = await planPayload(created.id, [kept]);
    forged.set("stamp", "0".repeat(64));
    await assert.rejects(saveCoursePlan(instructorId, created.id, "ka", forged), rejected("stale"));
    await assert.rejects(saveCoursePlan(otherInstructorId, created.id, "ka", await planPayload(created.id, [kept])), rejected("denied"));

    const rolled = await db.learningItem.findUniqueOrThrow({
      where: { id: lesson.id },
      select: { published: true, preview: true, translations: { where: { locale: "ka" }, select: { title: true } },
        assets: { select: { id: true, objectKey: true, name: true, data: true } }, progress: { select: { positionSec: true } } },
    });
    assert.equal(rolled.translations[0]?.title, "გაკვეთილი");
    assert.equal(rolled.published, false);
    assert.equal(rolled.preview, false);
    assert.equal(rolled.assets[0]?.id, asset.id);
    assert.equal(rolled.assets[0]?.objectKey, asset.objectKey);
    assert.equal(rolled.assets[0]?.name, "diagram.png");
    assert.equal(Buffer.from(rolled.assets[0]?.data ?? []).equals(Buffer.from(pngBytes)), true);
    assert.deepEqual(rolled.progress, [{ positionSec: 9 }]);

    const addedLesson = randomUUID();
    const addedModule = randomUUID();
    const addedFile = randomUUID();
    const nestedLesson = randomUUID();
    await saveCoursePlan(instructorId, created.id, "ka", await planPayload(created.id, [
      { key: addedModule, id: null, title: "ახალი მოდული", lessons: [{
        key: nestedLesson, id: null, title: "ჩადგმული", body: "ჩადგმული ტექსტი", video: "https://youtu.be/abcdefghijk", published: true, assets: [],
      }] },
      { ...kept, lessons: [
        { key: addedLesson, id: null, title: "მეორე", body: "მეორე ტექსტი", video: "", published: false, assets: [{ key: addedFile, id: null, action: "create" }] },
        { ...kept.lessons[0], title: "განახლებული გაკვეთილი", assets: [{ key: asset.id, id: asset.id, action: "replace" }] },
      ] },
    ], {
      [addedFile]: planFile(pngBytes, "extra.png"),
      [asset.id]: planFile(pdfBytes, "guide.pdf"),
    }));

    const modules = await db.module.findMany({
      where: { courseId: created.id }, orderBy: { position: "asc" },
      select: { id: true, position: true, titles: true, items: { orderBy: { position: "asc" }, select: {
        id: true, kind: true, position: true, published: true, preview: true, releaseAt: true, delayDays: true,
        videoSource: true, videoRef: true,
        translations: { select: { locale: true, title: true } },
        assets: { select: { id: true, objectKey: true, name: true, mimeType: true, data: true } },
        progress: { select: { positionSec: true } },
      } } },
    });
    assert.equal(modules.length, 2);
    assert.equal((modules[0]?.titles as { ka?: string }).ka, "ახალი მოდული");
    assert.equal(modules[0]?.items[0]?.published, true);
    assert.equal(modules[0]?.items[0]?.preview, false);
    assert.equal(modules[0]?.items[0]?.videoSource, "YOUTUBE");
    assert.equal(modules[0]?.items[0]?.videoRef, "abcdefghijk");
    assert.equal(modules[1]?.id, courseModule.id);
    assert.equal(modules[1]?.position, courseModule.position + 1);
    const items = modules[1]?.items ?? [];
    assert.deepEqual(items.map((item) => item.kind), ["LESSON", "QUIZ", "LESSON"]);
    assert.equal(items[0]?.translations.find((row) => row.locale === "ka")?.title, "მეორე");
    assert.equal(items[0]?.published, false);
    assert.equal(items[0]?.assets[0]?.name, "extra.png");
    assert.equal(items[1]?.id, quiz.id);
    assert.equal(items[1]?.position, quiz.position);
    assert.equal(items[2]?.id, lesson.id);
    assert.equal(items[2]?.published, false);
    assert.equal(items[2]?.preview, false);
    assert.equal(items[2]?.releaseAt, null);
    assert.equal(items[2]?.delayDays, null);
    assert.equal(items[2]?.translations.find((row) => row.locale === "ka")?.title, "განახლებული გაკვეთილი");
    assert.equal(items[2]?.assets[0]?.id, asset.id);
    assert.equal(items[2]?.assets[0]?.objectKey, asset.objectKey);
    assert.equal(items[2]?.assets[0]?.name, "guide.pdf");
    assert.equal(items[2]?.assets[0]?.mimeType, "application/pdf");
    assert.equal(Buffer.from(items[2]?.assets[0]?.data ?? []).equals(Buffer.from(pdfBytes)), true);
    assert.deepEqual(items[2]?.progress, [{ positionSec: 9 }]);
    const course = await db.course.findUniqueOrThrow({
      where: { id: created.id },
      select: { slug: true, priceRegular: true, translations: { where: { locale: "ka" }, select: { title: true } } },
    });
    assert.equal(course.slug, slug);
    assert.equal(course.priceRegular, null);
    assert.equal(course.translations[0]?.title, "საწყისი");

    const englishLesson = randomUUID();
    await saveCoursePlan(instructorId, created.id, "en", await planPayload(created.id, [
      { key: modules[0]?.id, id: modules[0]?.id, title: "New module", lessons: [{
        key: modules[0]?.items[0]?.id, id: modules[0]?.items[0]?.id, title: "Nested", body: "Nested text", video: "https://youtu.be/abcdefghijk", assets: [],
      }] },
      { key: courseModule.id, id: courseModule.id, title: "Module", lessons: [
        { key: items[0]?.id, id: items[0]?.id, title: "Second", body: "Second text", video: "", assets: [{
          key: items[0]?.assets[0]?.id, id: items[0]?.assets[0]?.id, action: "keep",
        }] },
        { key: englishLesson, id: null, title: "English only", body: "English text", video: "", assets: [] },
        { key: lesson.id, id: lesson.id, title: "Updated lesson", body: "Updated text", video: "", assets: [{
          key: asset.id, id: asset.id, action: "keep",
        }] },
      ] },
    ]));
    const english = await db.learningItem.findUniqueOrThrow({
      where: { id: lesson.id },
      select: { published: true, translations: { select: { locale: true, title: true } } },
    });
    assert.equal(english.published, false);
    assert.equal(english.translations.find((row) => row.locale === "ka")?.title, "განახლებული გაკვეთილი");
    assert.equal(english.translations.find((row) => row.locale === "en")?.title, "Updated lesson");
    const englishOnly = await db.learningItem.findFirstOrThrow({
      where: { moduleId: courseModule.id, translations: { some: { title: "English only" } } },
      select: { published: true, preview: true, translations: { select: { locale: true } } },
    });
    assert.equal(englishOnly.published, false);
    assert.equal(englishOnly.preview, false);
    assert.deepEqual(englishOnly.translations.map((row) => row.locale), ["en"]);
  } finally {
    const slugs = [slug];
    await admin.query(`DELETE FROM app."Progress" WHERE "userId" = ANY($1::uuid[]) OR "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($2::text[]))
    )`, [users, slugs]);
    await admin.query(`DELETE FROM app."LessonAsset" WHERE "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))
    )`, [slugs]);
    await admin.query(`DELETE FROM app."ItemTranslation" WHERE "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))
    )`, [slugs]);
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
      (SELECT count(*) FROM app."Course")::int AS courses,
      (SELECT count(*) FROM app."LearningItem")::int AS items,
      (SELECT count(*) FROM app."LessonAsset")::int AS assets,
      (SELECT count(*) FROM app."Progress")::int AS progress`);
    assert.deepEqual(after.rows[0], before.rows[0]);
    await admin.end();
  }
});

test("a plan save waits on the course row lock and rejects a structure changed underneath", async () => {
  const admin = new pg.Client({
    host: "127.0.0.1", port: 55432, database: "betterlife",
    user: adminUrl.username, password: adminUrl.password,
  });
  const adminId = randomUUID();
  const slug = `lock-${randomUUID()}`;
  const users = [adminId];
  await admin.connect();
  const before = await admin.query(`SELECT
    (SELECT count(*) FROM app."Course")::int AS courses,
    (SELECT count(*) FROM app."Module")::int AS modules,
    (SELECT count(*) FROM app."LearningItem")::int AS items,
    (SELECT count(*) FROM app."Progress")::int AS progress`);
  let outcome: Promise<unknown> | undefined;
  try {
    await admin.query(
      `INSERT INTO app."AppUser"(id, "displayName", role) VALUES ($1::uuid, 'Lock admin', 'ADMIN'::app."Role")`,
      [adminId],
    );
    const created = await createCourse(adminId, fields({ title: "საწყისი", slug, body: "ძველი" }));
    await mutateCourse(adminId, created.id, "module-new", "ka", fields({ title: "მოდული" }));
    const courseModule = await db.module.findFirstOrThrow({
      where: { courseId: created.id }, select: { id: true, position: true },
    });
    await mutateCourse(adminId, created.id, "lesson-new", "ka", fields({
      target: courseModule.id, title: "გაკვეთილი", body: "ტექსტი",
    }));
    const lesson = await db.learningItem.findFirstOrThrow({
      where: { moduleId: courseModule.id, kind: "LESSON" },
      select: { id: true },
    });
    const snapshot = await planPayload(created.id, [{
      key: courseModule.id, id: courseModule.id, title: "მოდული",
      lessons: [{ key: lesson.id, id: lesson.id, title: "გადაწერილი", body: "ტექსტი", video: "", assets: [] }],
    }]);
    await admin.query("BEGIN");
    await admin.query(`SELECT id FROM app."Course" WHERE id = $1::uuid FOR UPDATE`, [created.id]);
    let settled = false;
    outcome = saveCoursePlan(adminId, created.id, "ka", snapshot).then(
      () => {
        settled = true;
        return "saved";
      },
      (error: unknown) => {
        settled = true;
        return error;
      },
    );
    const deadline = Date.now() + 1500;
    let waiters = 0;
    while (Date.now() < deadline && waiters < 1 && !settled) {
      const waiting = await admin.query<{ waiters: number }>(`
        SELECT count(*)::int AS waiters
        FROM pg_stat_activity
        WHERE pg_backend_pid() = ANY (pg_blocking_pids(pid))`);
      waiters = Number(waiting.rows[0]?.waiters ?? 0);
      if (waiters < 1 && !settled) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(settled, false);
    assert.ok(waiters >= 1);
    await admin.query(
      `INSERT INTO app."Module"(id, "courseId", position, titles)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)`,
      [randomUUID(), created.id, courseModule.position + 1, JSON.stringify({ ka: "პარალელური" })],
    );
    await admin.query("COMMIT");
    const result = await outcome;
    assert.ok(result instanceof EditorError);
    assert.equal(result.code, "stale");
    const stored = await db.learningItem.findUniqueOrThrow({
      where: { id: lesson.id },
      select: { translations: { where: { locale: "ka" }, select: { title: true } } },
    });
    assert.equal(stored.translations[0]?.title, "გაკვეთილი");
  } finally {
    await admin.query("ROLLBACK");
    if (outcome) await outcome;
    const slugs = [slug];
    await admin.query(`DELETE FROM app."Progress" WHERE "userId" = ANY($1::uuid[]) OR "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($2::text[]))
    )`, [users, slugs]);
    await admin.query(`DELETE FROM app."LessonAsset" WHERE "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))
    )`, [slugs]);
    await admin.query(`DELETE FROM app."ItemTranslation" WHERE "itemId" IN (
      SELECT i.id FROM app."LearningItem" i JOIN app."Module" m ON m.id = i."moduleId"
      WHERE m."courseId" IN (SELECT id FROM app."Course" WHERE slug = ANY($1::text[]))
    )`, [slugs]);
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
    const afterCounts = await admin.query(`SELECT
      (SELECT count(*) FROM app."Course")::int AS courses,
      (SELECT count(*) FROM app."Module")::int AS modules,
      (SELECT count(*) FROM app."LearningItem")::int AS items,
      (SELECT count(*) FROM app."Progress")::int AS progress`);
    assert.deepEqual(afterCounts.rows[0], before.rows[0]);
    await admin.end();
  }
});
