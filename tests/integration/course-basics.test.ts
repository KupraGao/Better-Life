import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { parseEnv } from "node:util";
import pg from "pg";
import { formatGel, normalizeSlug, readCover, readGel } from "../../src/modules/catalog/basics";

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
const { EditorError, createCourse, mutateCategory, mutateCourse } = await import("../../src/modules/catalog/manage");
const { canonicalSlug, enrollForFree, listCourses, readCourse } = await import("../../src/modules/learning/service");

after(() => db.$disconnect());

function rejected(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof EditorError);
    assert.equal(error.code, code);
    return true;
  };
}

test("course basics keep prices, categories, and old links inside the local database", async () => {
  assert.equal(readGel("240"), 24000);
  assert.equal(readGel("160.50"), 16050);
  assert.equal(readGel(""), null);
  assert.equal(readGel("0"), undefined);
  assert.equal(readGel("240.001"), undefined);
  assert.equal(formatGel(24000), "240 GEL");
  assert.equal(formatGel(16050), "160.50 GEL");
  assert.equal(readCover("https://cdn.example.com/cover.jpg"), "https://cdn.example.com/cover.jpg");
  assert.equal(readCover("http://cdn.example.com/cover.jpg"), undefined);
  assert.equal(readCover("https://user:secret@cdn.example.com/cover.jpg"), undefined);
  assert.equal(normalizeSlug("Dyslexia Course"), "dyslexia-course");

  const admin = new pg.Client({
    host: "127.0.0.1", port: 55432, database: "betterlife",
    user: adminUrl.username, password: adminUrl.password,
  });
  const adminId = randomUUID();
  const instructorId = randomUUID();
  const studentId = randomUUID();
  const slug = `basics-${randomUUID()}`;
  const otherSlug = `basics-other-${randomUUID()}`;
  const renamed = `basics-renamed-${randomUUID()}`;
  const categorySlug = `basics-cat-${randomUUID()}`;
  await admin.connect();
  const before = await admin.query(`SELECT
    (SELECT count(*) FROM app."Course")::int AS courses,
    (SELECT count(*) FROM app."Enrollment")::int AS enrollments,
    (SELECT count(*) FROM app."Progress")::int AS progress`);
  try {
    await admin.query(
      `INSERT INTO app."AppUser"(id, "displayName", role) VALUES
        ($1::uuid, 'Basics admin', 'ADMIN'::app."Role"),
        ($2::uuid, 'Basics instructor', 'INSTRUCTOR'::app."Role"),
        ($3::uuid, 'Basics student', 'STUDENT'::app."Role")`,
      [adminId, instructorId, studentId],
    );
    const categoryForm = new FormData();
    categoryForm.set("title", "სპეციალური განათლება");
    categoryForm.set("titleEn", "Special education");
    categoryForm.set("slug", categorySlug);
    await assert.rejects(mutateCategory(studentId, "category-new", categoryForm), rejected("denied"));
    await assert.rejects(mutateCategory(instructorId, "category-new", categoryForm), rejected("denied"));
    await mutateCategory(adminId, "category-new", categoryForm);
    const category = await db.category.findUniqueOrThrow({ where: { slug: categorySlug }, select: { id: true } });

    const form = new FormData();
    form.set("title", "საფუძვლები");
    form.set("slug", slug);
    form.set("body", "აღწერა");
    const created = await createCourse(adminId, form);
    const other = new FormData();
    other.set("title", "მეორე");
    other.set("slug", otherSlug);
    other.set("body", "");
    const second = await createCourse(adminId, other);

    const assign = new FormData();
    assign.set("userId", instructorId);
    await mutateCourse(adminId, created.id, "assign", "ka", assign);
    const enroll = new FormData();
    enroll.set("userId", studentId);
    await mutateCourse(adminId, created.id, "enroll", "ka", enroll);
    const membership = await db.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: studentId, courseId: created.id } }, select: { id: true },
    });

    const priced = new FormData();
    priced.set("mode", "paid");
    priced.set("priceRegular", "240");
    priced.set("priceSale", "240");
    priced.set("listed", "on");
    await assert.rejects(mutateCourse(instructorId, created.id, "access", "ka", priced), rejected("denied"));
    await assert.rejects(mutateCourse(adminId, created.id, "access", "ka", priced), rejected("price"));
    priced.set("priceSale", "300");
    await assert.rejects(mutateCourse(adminId, created.id, "access", "ka", priced), rejected("price"));
    priced.set("priceSale", "160");
    await mutateCourse(adminId, created.id, "access", "ka", priced);
    const paid = await db.course.findUniqueOrThrow({
      where: { id: created.id },
      select: { freeEnrollment: true, priceRegular: true, priceSale: true, listed: true },
    });
    assert.deepEqual(paid, { freeEnrollment: false, priceRegular: 24000, priceSale: 16000, listed: true });

    const basics = new FormData();
    basics.set("slug", renamed);
    basics.set("cover", "http://cdn.example.com/cover.jpg");
    basics.set("level", "BEGINNER");
    basics.append("category", category.id);
    await assert.rejects(mutateCourse(instructorId, created.id, "basics", "ka", basics), rejected("cover"));
    basics.set("cover", "https://cdn.example.com/cover.jpg");
    await mutateCourse(instructorId, created.id, "basics", "ka", basics);
    const saved = await db.course.findUniqueOrThrow({
      where: { id: created.id },
      select: { slug: true, level: true, coverImage: true, categories: { select: { categoryId: true } } },
    });
    assert.equal(saved.slug, renamed);
    assert.equal(saved.level, "BEGINNER");
    assert.equal(saved.coverImage, "https://cdn.example.com/cover.jpg");
    assert.deepEqual(saved.categories, [{ categoryId: category.id }]);
    assert.equal(await db.$transaction((tx) => canonicalSlug(tx, slug)), renamed);
    assert.equal((await db.enrollment.findUniqueOrThrow({ where: { id: membership.id }, select: { courseId: true } })).courseId, created.id);

    const taken = new FormData();
    taken.set("slug", otherSlug);
    taken.set("cover", "");
    taken.set("level", "");
    await assert.rejects(mutateCourse(adminId, created.id, "basics", "ka", taken), rejected("duplicate"));

    await db.course.update({ where: { id: created.id }, data: { published: true } });
    await db.$transaction(async (tx) => {
      assert.equal(await enrollForFree(tx, "ka", renamed, studentId), false);
      assert.equal((await listCourses(tx, "ka")).some((course) => course.slug === renamed), true);
      assert.equal((await readCourse(tx, "ka", renamed, null))?.priceSale, 16000);
    });

    const hidden = new FormData();
    hidden.set("mode", "closed");
    await mutateCourse(adminId, created.id, "access", "ka", hidden);
    await db.$transaction(async (tx) => {
      assert.equal((await listCourses(tx, "ka")).some((course) => course.slug === renamed), false);
      assert.ok(await readCourse(tx, "ka", renamed, studentId));
    });
    assert.equal((await db.course.findUniqueOrThrow({
      where: { id: created.id }, select: { priceRegular: true, freeEnrollment: true },
    })).priceRegular, null);

    await assert.rejects(mutateCategory(adminId, "category-delete", (() => {
      const data = new FormData();
      data.set("target", category.id);
      return data;
    })()), rejected("category"));
    const cleared = new FormData();
    cleared.set("slug", renamed);
    cleared.set("cover", "https://cdn.example.com/cover.jpg");
    cleared.set("level", "BEGINNER");
    await mutateCourse(adminId, created.id, "basics", "ka", cleared);
    const remove = new FormData();
    remove.set("target", category.id);
    await mutateCategory(adminId, "category-delete", remove);
    assert.equal(await db.category.count({ where: { id: category.id } }), 0);
    assert.equal(await db.enrollment.count({ where: { id: membership.id } }), 1);
    assert.equal(second.id.length > 0, true);
  } finally {
    await admin.query(`DELETE FROM app."Enrollment" WHERE "userId" = $1::uuid OR "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($2::text[])
    )`, [studentId, [slug, otherSlug, renamed]]);
    await admin.query(`DELETE FROM app."CourseInstructor" WHERE "userId" = ANY($1::uuid[]) OR "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($2::text[])
    )`, [[adminId, instructorId, studentId], [slug, otherSlug, renamed]]);
    await admin.query(`DELETE FROM app."CourseCategory" WHERE "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
    ) OR "categoryId" IN (SELECT id FROM app."Category" WHERE slug = $2)`, [[slug, otherSlug, renamed], categorySlug]);
    await admin.query(`DELETE FROM app."CourseSlugAlias" WHERE slug = ANY($1::text[]) OR "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
    )`, [[slug, otherSlug, renamed]]);
    await admin.query(`DELETE FROM app."CourseTranslation" WHERE "courseId" IN (
      SELECT id FROM app."Course" WHERE slug = ANY($1::text[])
    )`, [[slug, otherSlug, renamed]]);
    await admin.query(`DELETE FROM app."Course" WHERE slug = ANY($1::text[])`, [[slug, otherSlug, renamed]]);
    await admin.query(`DELETE FROM app."CategoryTranslation" WHERE "categoryId" IN (
      SELECT id FROM app."Category" WHERE slug = $1
    )`, [categorySlug]);
    await admin.query(`DELETE FROM app."Category" WHERE slug = $1`, [categorySlug]);
    await admin.query(`DELETE FROM app."AppUser" WHERE id = ANY($1::uuid[])`, [[adminId, instructorId, studentId]]);
    const after = await admin.query(`SELECT
      (SELECT count(*) FROM app."Course")::int AS courses,
      (SELECT count(*) FROM app."Enrollment")::int AS enrollments,
      (SELECT count(*) FROM app."Progress")::int AS progress`);
    assert.deepEqual(after.rows[0], before.rows[0]);
    await admin.end();
  }
});
