import type { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n";
import { releasedItemWhere, visibleLessonWhere } from "@/modules/learning/visibility";

const payload = { name: true, data: true, kind: true, mimeType: true, sizeBytes: true } as const;

/** Execute in a consistent snapshot so an enrollment and its protected asset are read together. */
export async function readAsset(store: Prisma.TransactionClient, id: string, locale: Locale, actor: { id: string; role: string } | null) {
  const meta = await store.lessonAsset.findUnique({ where: { id }, select: {
    item: { select: { id: true, module: { select: { courseId: true } } } },
  } });
  if (!meta) return null;
  const courseId = meta.item.module.courseId;
  const author = actor && (actor.role === "ADMIN" || (actor.role === "INSTRUCTOR" &&
    await store.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId: actor.id } }, select: { userId: true } })));
  if (author) {
    return store.lessonAsset.findFirst({ where: { id, item: { archivedAt: null, module: {
      archivedAt: null, course: { archivedAt: null },
    } } }, select: payload });
  }
  const enrollment = actor && await store.enrollment.findUnique({
    where: { userId_courseId: { userId: actor.id, courseId } }, select: { enrolledAt: true },
  });
  if (!enrollment) return null;
  return store.lessonAsset.findFirst({ where: { id, item: { AND: [
    visibleLessonWhere(locale), releasedItemWhere(enrollment.enrolledAt),
  ] } }, select: payload });
}
