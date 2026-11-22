import type { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n";

export const activeLesson = { published: true, archivedAt: null, kind: "LESSON" } as const;
const day = 86_400_000;

export function visibleCourseWhere(locale: Locale): Prisma.CourseWhereInput {
  return {
    published: true,
    archivedAt: null,
    translations: { some: { locale } },
    modules: { none: {
      archivedAt: null,
      items: { some: { ...activeLesson, translations: { none: { locale } } } }
    } }
  };
}

export function visibleLessonWhere(locale: Locale): Prisma.LearningItemWhereInput {
  return {
    ...activeLesson,
    translations: { some: { locale } },
    module: { archivedAt: null, course: visibleCourseWhere(locale) }
  };
}

export function releasedItemWhere(enrolledAt: Date | null, now = new Date()): Prisma.LearningItemWhereInput {
  const days = enrolledAt ? Math.floor((now.getTime() - enrolledAt.getTime()) / day) : 0;
  return {
    AND: [
      { OR: [{ releaseAt: null }, { releaseAt: { lte: now } }] },
      { OR: [{ delayDays: null }, { delayDays: { lte: days } }] }
    ]
  };
}

export function isReleased(item: { releaseAt: Date | null; delayDays: number | null }, enrolledAt: Date | null, now = new Date()) {
  const days = item.delayDays ?? 0;
  return (!item.releaseAt || item.releaseAt <= now)
    && (days === 0 || (enrolledAt !== null && enrolledAt.getTime() + days * day <= now.getTime()));
}
