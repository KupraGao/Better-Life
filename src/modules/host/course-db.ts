import type { CourseDb } from "@kupragao/lms-core";

export const courseDb: CourseDb = {
  async lockActor(tx, id) {
    const [actor] = await tx.$queryRaw<{ id: string; role: string }[]>`
      SELECT id, role::text AS role FROM app."AppUser" WHERE id = ${id}::uuid FOR SHARE`;
    return actor ?? null;
  },
  async lockCourse(tx, courseId) {
    await tx.$queryRaw`SELECT id FROM app."Course" WHERE id = ${courseId}::uuid FOR UPDATE`;
  },
  async foreignCourseId(tx, courseId, slug) {
    const [row] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app."Course" WHERE slug = ${slug} AND id <> ${courseId}::uuid FOR UPDATE`;
    return row?.id ?? null;
  },
  async foreignAliasCourseId(tx, courseId, slug) {
    const [row] = await tx.$queryRaw<{ courseId: string }[]>`
      SELECT "courseId" FROM app."CourseSlugAlias" WHERE slug = ${slug} AND "courseId" <> ${courseId}::uuid FOR UPDATE`;
    return row?.courseId ?? null;
  },
  async appUserRole(tx, userId) {
    const target = await tx.appUser.findUnique({ where: { id: userId }, select: { role: true } });
    return target?.role ?? null;
  },
};
