import {
  accessStampFrom,
  basicsStampFrom,
  completeLesson,
  createCourse,
  enrollForFree,
  mutateCourse,
  planStampFrom,
  readAsset,
  readCourse,
  readLesson,
  saveCourseAccess,
  saveCourseBasics,
  saveCoursePlan,
  type CourseDb,
} from "@kupragao/lms-core";
import { commitLearningChange, getDb, openDb, courseDb } from "./db";

const locale = "ka" as const;
type Client = ReturnType<typeof openDb>;

const basicsSelect = {
  slug: true, coverImage: true, level: true,
  categories: { select: { categoryId: true } },
  translations: { select: { locale: true, title: true, description: true } },
} as const;
const accessSelect = { freeEnrollment: true, listed: true, priceRegular: true, priceSale: true } as const;
const planSelect = {
  id: true, titles: true,
  items: {
    where: { kind: "LESSON" as const, archivedAt: null },
    orderBy: { position: "asc" as const },
    select: {
      id: true, published: true, videoSource: true, videoRef: true,
      translations: { select: { locale: true, title: true, body: true } },
      assets: { select: { id: true } },
    },
  },
} as const;

function dbOf(client?: Client) {
  return client ?? getDb();
}

export async function createDevCourse(actorId: string, slug: string, title: string, client?: Client) {
  const form = new FormData();
  form.set("title", title);
  form.set("body", "Dev host course.");
  form.set("slug", slug);
  const created = await createCourse(dbOf(client), courseDb as CourseDb, actorId, form);
  return created.id as string;
}

export async function saveDevBasics(actorId: string, courseId: string, slug: string, title: string, client?: Client) {
  const db = dbOf(client);
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: basicsSelect });
  const form = new FormData();
  form.set("stamp", basicsStampFrom(course));
  form.set("title", title);
  form.set("body", "Updated basics.");
  form.set("slug", slug);
  form.set("cover", "");
  form.set("level", "");
  return saveCourseBasics(db, courseDb as CourseDb, actorId, courseId, locale, form);
}

export async function saveDevPlan(actorId: string, courseId: string, lesson: {
  title: string; body: string; video: string; published: boolean;
}, hidden: { title: string }, client?: Client) {
  const db = dbOf(client);
  const modules = await db.module.findMany({
    where: { courseId, archivedAt: null }, orderBy: { position: "asc" }, select: planSelect,
  });
  const form = new FormData();
  form.set("stamp", planStampFrom(modules));
  form.set("plan", JSON.stringify({ modules: [{
    key: "module-1", id: null, title: "Dev module", remove: false,
    lessons: [
      { key: "lesson-1", id: null, title: lesson.title, body: lesson.body, video: lesson.video, published: lesson.published, assets: [] },
      { key: "lesson-2", id: null, title: hidden.title, body: "Hidden lesson.", video: "", published: false, assets: [] },
    ],
  }] }));
  return saveCoursePlan(db, courseDb as CourseDb, actorId, courseId, locale, form);
}

export async function saveDevAccess(actorId: string, courseId: string, client?: Client) {
  const db = dbOf(client);
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: accessSelect });
  const form = new FormData();
  form.set("stamp", accessStampFrom(course));
  form.set("mode", "free");
  form.set("listed", "on");
  form.set("priceRegular", "");
  form.set("priceSale", "");
  return saveCourseAccess(db, courseDb as CourseDb, actorId, courseId, form);
}

export async function publishDevCourse(actorId: string, courseId: string, client?: Client) {
  await mutateCourse(dbOf(client), courseDb as CourseDb, actorId, courseId, "publish", locale, new FormData());
}

export async function assignDevInstructor(actorId: string, courseId: string, instructorId: string, client?: Client) {
  const form = new FormData();
  form.set("userId", instructorId);
  await mutateCourse(dbOf(client), courseDb as CourseDb, actorId, courseId, "assign", locale, form);
}

export function enrollDevStudent(actorId: string, slug: string) {
  return commitLearningChange((tx) => enrollForFree(tx, locale, slug, actorId));
}

export function openDevLesson(actorId: string | null, slug: string, itemId: string, client?: Client) {
  return readLesson(dbOf(client), locale, slug, itemId, actorId);
}

export function openDevCourse(actorId: string | null, slug: string, client?: Client) {
  return readCourse(dbOf(client), locale, slug, actorId);
}

export function completeDevLesson(actorId: string, slug: string, itemId: string) {
  return commitLearningChange((tx) => completeLesson(tx, locale, slug, itemId, actorId));
}

export async function readDevAsset(actorId: string | null, assetId: string, client?: Client) {
  const db = dbOf(client);
  const actor = actorId ? await db.appUser.findUnique({ where: { id: actorId }, select: { id: true, role: true } }) : null;
  return readAsset(db, assetId, locale, actor);
}

export async function addDevAsset(actorId: string, courseId: string, lessonId: string, file: File, client?: Client) {
  const form = new FormData();
  form.set("target", lessonId);
  form.set("file", file);
  await mutateCourse(dbOf(client), courseDb as CourseDb, actorId, courseId, "asset", locale, form);
}
