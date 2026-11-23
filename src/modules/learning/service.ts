import type { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n";
import { activeLesson, isReleased, releasedItemWhere, visibleCourseWhere, visibleLessonWhere } from "./visibility";

type Store = Prisma.TransactionClient;
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

function courseProjection(locale: Locale, userId: string | null) {
  const owned = { userId: { in: userId ? [userId] : [] } };
  return {
    id: true, slug: true, freeEnrollment: true, coverImage: true, level: true, priceRegular: true, priceSale: true,
    categories: { select: { category: { select: { slug: true, translations: { select: { locale: true, title: true } } } } } },
    translations: { where: { locale }, select: { title: true, description: true } },
    enrollments: { where: owned, select: { enrolledAt: true, completedAt: true } },
    modules: {
      where: { archivedAt: null, items: { some: activeLesson } },
      orderBy: { position: "asc" },
      select: {
        id: true, titles: true, position: true,
        items: {
          where: activeLesson, orderBy: { position: "asc" },
          select: {
            id: true, preview: true, releaseAt: true, delayDays: true,
            progress: { where: owned, select: { completedAt: true } },
            translations: { where: { locale }, select: { title: true } }
          }
        }
      }
    }
  } satisfies Prisma.CourseSelect;
}

type CourseRecord = Prisma.CourseGetPayload<{ select: ReturnType<typeof courseProjection> }>;

function categoryNames(
  rows: { category: { slug: string; translations: { locale: string; title: string }[] } }[],
  locale: Locale,
) {
  return rows.flatMap((row) => {
    const title = row.category.translations.find((item) => item.locale === locale)?.title
      ?? row.category.translations.find((item) => item.locale !== locale)?.title;
    return title ? [{ slug: row.category.slug, title }] : [];
  });
}

function titled(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  return value;
}

function readLocaleTitle(titles: unknown, locale: string) {
  if (!titles || typeof titles !== "object" || Array.isArray(titles) || !(locale in titles)) return "";
  return titled(Reflect.get(titles, locale));
}

function moduleTitle(titles: unknown, locale: Locale, position: number) {
  const own = readLocaleTitle(titles, locale);
  if (own) return { title: own, fallback: false };
  const other = readLocaleTitle(titles, locale === "ka" ? "en" : "ka");
  if (other) return { title: other, fallback: true };
  return { title: `${locale === "ka" ? "მოდული" : "Module"} ${position}`, fallback: false };
}

/** Whole percent that stays below 100 until every required lesson is complete. */
export function progressPercent(completed: number, total: number) {
  if (!Number.isInteger(completed) || !Number.isInteger(total) || total <= 0 || completed <= 0) return 0;
  if (completed >= total) return 100;
  return Math.floor((completed * 100) / total);
}

function describeCourse(course: CourseRecord, locale: Locale) {
  const membership = course.enrollments[0];
  const now = new Date();
  const modules = course.modules.map((courseModule) => {
    const named = moduleTitle(courseModule.titles, locale, courseModule.position);
    return {
      id: courseModule.id,
      title: named.title,
      fallback: named.fallback,
      lessons: courseModule.items.map((item) => ({
        id: item.id,
        title: item.translations[0].title,
        preview: item.preview,
        completed: !!membership && !!item.progress[0]?.completedAt,
        accessible: (!!membership || item.preview) && isReleased(item, membership?.enrolledAt ?? null, now)
      }))
    };
  });
  const lessons = modules.flatMap((courseModule) => courseModule.lessons);
  const completed = lessons.filter((item) => item.completed).length;
  return {
    id: course.id, slug: course.slug, freeEnrollment: course.freeEnrollment, coverImage: course.coverImage,
    level: course.level, priceRegular: course.priceRegular, priceSale: course.priceSale,
    categories: categoryNames(course.categories, locale),
    ...course.translations[0], enrolled: !!membership, modules,
    total: lessons.length, completed, percent: progressPercent(completed, lessons.length),
    finished: !!membership && lessons.length > 0 && completed === lessons.length,
    nextLesson: lessons.find((lesson) => lesson.accessible && !lesson.completed) ?? lessons.find((lesson) => lesson.accessible)
  };
}

export async function listCourses(store: Store, locale: Locale, categorySlug?: string) {
  const courses = await store.course.findMany({
    where: {
      ...visibleCourseWhere(locale), listed: true,
      ...(categorySlug ? { categories: { some: { category: { slug: categorySlug } } } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { slug: "asc" }],
    select: {
      slug: true, freeEnrollment: true, coverImage: true, level: true, priceRegular: true, priceSale: true,
      translations: { where: { locale }, select: { title: true, description: true } },
      categories: { select: { category: { select: { slug: true, translations: { select: { locale: true, title: true } } } } } },
      modules: { where: { archivedAt: null }, select: { _count: { select: { items: { where: activeLesson } } } } }
    }
  });
  return courses.map((course) => ({
    slug: course.slug, freeEnrollment: course.freeEnrollment, coverImage: course.coverImage,
    level: course.level, priceRegular: course.priceRegular, priceSale: course.priceSale,
    categories: categoryNames(course.categories, locale),
    ...course.translations[0], total: course.modules.reduce((count, mod) => count + mod._count.items, 0)
  }));
}

export async function listCatalogCategories(store: Store, locale: Locale) {
  const rows = await store.category.findMany({
    where: { courses: { some: { course: { ...visibleCourseWhere(locale), listed: true } } } },
    orderBy: { slug: "asc" },
    select: { slug: true, translations: { select: { locale: true, title: true } } },
  });
  return categoryNames(rows.map((row) => ({ category: row })), locale);
}

export async function canonicalSlug(store: Store, slug: string) {
  const direct = await store.course.findUnique({ where: { slug }, select: { slug: true } });
  if (direct) return direct.slug;
  const alias = await store.courseSlugAlias.findUnique({
    where: { slug }, select: { course: { select: { slug: true } } },
  });
  return alias?.course.slug ?? null;
}

export async function readCourse(store: Store, locale: Locale, slug: string, actorId: string | null) {
  const course = await store.course.findFirst({
    where: { slug, ...visibleCourseWhere(locale) }, select: courseProjection(locale, actorId)
  });
  return course ? describeCourse(course, locale) : null;
}

export async function myCourses(store: Store, locale: Locale, actorId: string) {
  const enrollments = await store.enrollment.findMany({
    where: { userId: actorId, course: visibleCourseWhere(locale) },
    orderBy: { enrolledAt: "desc" }, select: { course: { select: courseProjection(locale, actorId) } }
  });
  return enrollments.map(({ course }) => describeCourse(course, locale));
}

export async function enrollForFree(store: Store, locale: Locale, slug: string, actorId: string) {
  const course = await store.course.findFirst({
    where: { slug, ...visibleCourseWhere(locale), freeEnrollment: true },
    select: { id: true }
  });
  if (!course) return false;
  await store.enrollment.upsert({
    where: { userId_courseId: { userId: actorId, courseId: course.id } },
    create: { userId: actorId, courseId: course.id }, update: {}
  });
  return true;
}

export async function readLesson(store: Store, locale: Locale, slug: string, itemId: string, actorId: string | null) {
  if (!uuid.test(itemId)) return null;
  const course = await readCourse(store, locale, slug, actorId);
  const lessons = course?.modules.flatMap((courseModule) => courseModule.lessons);
  const current = lessons?.find((item) => item.id === itemId);
  if (!course || !lessons || !current?.accessible) return null;

  const membership = actorId ? await store.enrollment.findUnique({
    where: { userId_courseId: { userId: actorId, courseId: course.id } }, select: { enrolledAt: true }
  }) : null;
  const item = await store.learningItem.findFirst({
    where: {
      id: itemId,
      AND: [
        visibleLessonWhere(locale), { module: { courseId: course.id } },
        releasedItemWhere(membership?.enrolledAt ?? null),
        membership ? {} : { preview: true }
      ]
    },
    select: {
      videoSource: true, videoRef: true,
      translations: { where: { locale }, select: { body: true } },
      assets: { select: { id: true, kind: true, name: true, mimeType: true, sizeBytes: true }, orderBy: { id: "asc" } }
    }
  });
  if (!item) return null;
  const next = lessons.slice(lessons.findIndex((lesson) => lesson.id === itemId) + 1).find((lesson) => lesson.accessible);
  return { course, current, body: item.translations[0].body, assets: item.assets, videoSource: item.videoSource, videoRef: item.videoRef, next };
}

/** Execute inside a serializable transaction. The caller takes the user ID from its verified session. */
export async function completeLesson(store: Store, locale: Locale, slug: string, itemId: string, actorId: string) {
  if (!uuid.test(itemId)) return false;
  const membership = await store.enrollment.findFirst({
    where: { userId: actorId, course: { slug, ...visibleCourseWhere(locale) } },
    select: { id: true, courseId: true, enrolledAt: true }
  });
  if (!membership) return false;
  const now = new Date();
  const item = await store.learningItem.findFirst({
    where: { id: itemId, AND: [
      visibleLessonWhere(locale), { module: { courseId: membership.courseId } }, releasedItemWhere(membership.enrolledAt, now)
    ] },
    select: { id: true }
  });
  if (!item) return false;
  await store.progress.upsert({
    where: { userId_itemId: { userId: actorId, itemId } },
    create: { userId: actorId, itemId, completedAt: now }, update: {}
  });
  await store.progress.updateMany({ where: { userId: actorId, itemId, completedAt: null }, data: { completedAt: now } });
  const remaining = await store.learningItem.count({
    where: { ...activeLesson, module: { archivedAt: null, courseId: membership.courseId },
      progress: { none: { userId: actorId, completedAt: { not: null } } } }
  });
  if (remaining === 0) {
    await store.enrollment.updateMany({ where: { id: membership.id, completedAt: null }, data: { completedAt: now } });
  }
  return true;
}
