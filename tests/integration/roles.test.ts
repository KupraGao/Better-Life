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
const { EditorError, authorScope, createCourse, mutateCourse } = await import("../../src/modules/catalog/manage");

after(() => db.$disconnect());

function denied(error: unknown) {
  assert.ok(error instanceof EditorError);
  assert.equal(error.code, "denied");
  return true;
}

test("course management follows admin and instructor boundaries", async () => {
  const admin = new pg.Client({
    host: "127.0.0.1",
    port: 55432,
    database: "betterlife",
    user: adminUrl.username,
    password: adminUrl.password,
  });
  const adminId = randomUUID();
  const instructorId = randomUUID();
  const studentId = randomUUID();
  const slug = `role-test-${randomUUID()}`;
  await admin.connect();
  try {
    await admin.query(
      `INSERT INTO app."AppUser"(id, "displayName", role) VALUES
        ($1::uuid, 'Role admin', 'ADMIN'::app."Role"),
        ($2::uuid, 'Role instructor', 'INSTRUCTOR'::app."Role"),
        ($3::uuid, 'Role student', 'STUDENT'::app."Role")`,
      [adminId, instructorId, studentId],
    );
    const form = new FormData();
    form.set("title", "როლის კურსი");
    form.set("slug", slug);
    form.set("body", "სატესტო აღწერა");
    await assert.rejects(createCourse(studentId, form), denied);
    await assert.rejects(createCourse(instructorId, form), denied);
    assert.throws(() => authorScope({ id: studentId, role: "STUDENT" }), denied);

    const created = await createCourse(adminId, form);
    const visibleToAdmin = await db.course.findMany({
      where: authorScope({ id: adminId, role: "ADMIN" }),
      select: { id: true },
    });
    assert.equal(visibleToAdmin.some((course) => course.id === created.id), true);
    const beforeAssign = await db.course.findMany({
      where: authorScope({ id: instructorId, role: "INSTRUCTOR" }),
      select: { id: true },
    });
    assert.equal(beforeAssign.some((course) => course.id === created.id), false);

    const edit = new FormData();
    edit.set("title", "არ უნდა");
    edit.set("body", "არა");
    await assert.rejects(mutateCourse(instructorId, created.id, "course", "ka", edit), denied);
    const assign = new FormData();
    assign.set("userId", instructorId);
    await assert.rejects(mutateCourse(instructorId, created.id, "assign", "ka", assign), denied);
    await mutateCourse(adminId, created.id, "assign", "ka", assign);
    const afterAssign = await db.course.findMany({
      where: authorScope({ id: instructorId, role: "INSTRUCTOR" }),
      select: { id: true },
    });
    assert.equal(afterAssign.some((course) => course.id === created.id), true);

    edit.set("title", "ინსტრუქტორის განახლება");
    await mutateCourse(instructorId, created.id, "course", "ka", edit);
    const translation = await db.courseTranslation.findFirstOrThrow({
      where: { courseId: created.id, locale: "ka" },
      select: { title: true },
    });
    assert.equal(translation.title, "ინსტრუქტორის განახლება");

    const access = new FormData();
    access.set("free", "on");
    await assert.rejects(mutateCourse(instructorId, created.id, "access", "ka", access), denied);
    await mutateCourse(adminId, created.id, "access", "ka", access);
    assert.equal((await db.course.findUniqueOrThrow({ where: { id: created.id }, select: { freeEnrollment: true } })).freeEnrollment, true);

    const enroll = new FormData();
    enroll.set("userId", studentId);
    await assert.rejects(mutateCourse(instructorId, created.id, "enroll", "ka", enroll), denied);
    await mutateCourse(adminId, created.id, "enroll", "ka", enroll);
    assert.equal(await db.enrollment.count({ where: { userId: studentId, courseId: created.id } }), 1);
  } finally {
    await admin.query(
      `DELETE FROM app."Enrollment" WHERE "userId" IN ($1::uuid, $2::uuid, $3::uuid)
        OR "courseId" IN (SELECT id FROM app."Course" WHERE slug = $4)`,
      [adminId, instructorId, studentId, slug],
    );
    await admin.query(
      `DELETE FROM app."CourseInstructor" WHERE "userId" IN ($1::uuid, $2::uuid, $3::uuid)
        OR "courseId" IN (SELECT id FROM app."Course" WHERE slug = $4)`,
      [adminId, instructorId, studentId, slug],
    );
    await admin.query(`DELETE FROM app."CourseTranslation" WHERE "courseId" IN (SELECT id FROM app."Course" WHERE slug = $1)`, [slug]);
    await admin.query(`DELETE FROM app."Course" WHERE slug = $1`, [slug]);
    await admin.query(`DELETE FROM app."AppUser" WHERE id IN ($1::uuid, $2::uuid, $3::uuid)`, [adminId, instructorId, studentId]);
    await admin.end();
  }
});
