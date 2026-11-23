import type { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n";
import { db } from "@/lib/db";
import { normalizeSlug, readCover, readGel, readLevel } from "./basics";
import { parseText, parseVideo } from "./content";
import { detectAsset, maxAssetSize } from "../media/file-type";

type Transaction = Prisma.TransactionClient;
type Actor = { id: string; role: string };
export type ErrorCode = "invalid" | "denied" | "stale" | "publish" | "video" | "file" | "duplicate" | "price" | "cover" | "category";
export class EditorError extends Error {
  constructor(readonly code: ErrorCode) { super(code); }
}

export const isId = (input: string) => /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(input);

function value(form: FormData, key: string, max: number, required = true) {
  const raw = form.get(key);
  if (raw !== null && typeof raw !== "string") throw new EditorError("invalid");
  const text = (raw ?? "").trim();
  if ((required && !text) || text.length > max) throw new EditorError("invalid");
  return text;
}

function identifier(form: FormData, key: string) {
  const id = value(form, key, 36);
  if (!isId(id)) throw new EditorError("invalid");
  return id;
}

function slugValue(form: FormData) {
  const slug = normalizeSlug(value(form, "slug", 120));
  if (!slug) throw new EditorError("invalid");
  return slug;
}

function categoryIds(form: FormData) {
  const ids = form.getAll("category").map((item) => {
    if (typeof item !== "string" || !isId(item)) throw new EditorError("invalid");
    return item;
  });
  return [...new Set(ids)];
}

function uniqueConflict(error: unknown) {
  return !!error && typeof error === "object" && "code" in error && error.code === "P2002";
}

export function authorScope(actor: Actor): Prisma.CourseWhereInput {
  if (actor.role === "ADMIN") return { archivedAt: null };
  if (actor.role === "INSTRUCTOR") return { archivedAt: null, instructors: { some: { userId: actor.id } } };
  throw new EditorError("denied");
}

async function lockActor(tx: Transaction, id: string) {
  const [actor] = await tx.$queryRaw<Actor[]>`SELECT id, role::text AS role FROM app."AppUser" WHERE id = ${id}::uuid FOR SHARE`;
  if (!actor) throw new EditorError("denied");
  return actor;
}

export async function createCourse(actorId: string, form: FormData) {
  return db.$transaction(async (tx) => {
    const actor = await lockActor(tx, actorId);
    if (actor.role !== "ADMIN") throw new EditorError("denied");
    return tx.course.create({
      data: { slug: slugValue(form), translations: { create: {
        locale: "ka", title: value(form, "title", 180), description: parseText(value(form, "body", 16000, false)),
      } } }, select: { id: true },
    });
  });
}

async function requireModule(tx: Transaction, moduleId: string, courseId: string) {
  const courseModule = await tx.module.findFirst({ where: { id: moduleId, courseId, archivedAt: null } });
  if (!courseModule) throw new EditorError("denied");
  return courseModule;
}

async function requireLesson(tx: Transaction, itemId: string, courseId: string) {
  const item = await tx.learningItem.findFirst({
    where: { id: itemId, kind: "LESSON", archivedAt: null, module: { courseId, archivedAt: null } },
    select: { id: true, moduleId: true, module: { select: { titles: true } } },
  });
  if (!item) throw new EditorError("denied");
  return item;
}

export function moduleTitles(value: unknown): Partial<Record<Locale, string>> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([k,v]) => (k === "ka" || k === "en") && typeof v === "string"));
}

async function reorder(tx: Transaction, courseId: string, form: FormData, isModule: boolean) {
  const id = identifier(form, "target");
  const expected = identifier(form, "neighbor");
  const direction = value(form, "direction", 4);
  if (direction !== "up" && direction !== "down") throw new EditorError("invalid");
  const positions = { id: true, position: true, archivedAt: true };
  const rows = isModule
    ? await tx.module.findMany({ where: { courseId }, select: positions, orderBy: { position: "asc" } })
    : await tx.learningItem.findMany({ where: { moduleId: (await requireLesson(tx, id, courseId)).moduleId }, select: positions, orderBy: { position: "asc" } });
  const active = rows.filter((row) => !row.archivedAt);
  const index = active.findIndex((row) => row.id === id);
  const current = active[index];
  const adjacent = active[index + (direction === "up" ? -1 : 1)];
  if (!current || adjacent?.id !== expected) throw new EditorError("stale");
  const update = (rowId: string, position: number) => isModule
    ? tx.module.update({ where: { id: rowId }, data: { position }, select: { id: true } })
    : tx.learningItem.update({ where: { id: rowId }, data: { position }, select: { id: true } });
  await update(current.id, rows[rows.length - 1].position + 1);
  await update(adjacent.id, current.position);
  await update(current.id, adjacent.position);
}

async function renameSlug(tx: Transaction, courseId: string, next: string) {
  const current = await tx.course.findUnique({ where: { id: courseId }, select: { slug: true } });
  if (!current) throw new EditorError("denied");
  if (current.slug === next) return;
  const [foreignCourse] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM app."Course" WHERE slug = ${next} AND id <> ${courseId}::uuid FOR UPDATE`;
  if (foreignCourse) throw new EditorError("duplicate");
  const [foreignAlias] = await tx.$queryRaw<{ courseId: string }[]>`
    SELECT "courseId" FROM app."CourseSlugAlias" WHERE slug = ${next} AND "courseId" <> ${courseId}::uuid FOR UPDATE`;
  if (foreignAlias) throw new EditorError("duplicate");
  await tx.courseSlugAlias.deleteMany({ where: { slug: next, courseId } });
  try {
    await tx.course.update({ where: { id: courseId }, data: { slug: next } });
    await tx.courseSlugAlias.create({ data: { slug: current.slug, courseId } });
  } catch (error) {
    if (uniqueConflict(error)) throw new EditorError("duplicate");
    throw error;
  }
}

async function saveBasics(tx: Transaction, courseId: string, form: FormData) {
  const cover = readCover(value(form, "cover", 2000, false));
  if (cover === undefined) throw new EditorError("cover");
  const level = readLevel(value(form, "level", 20, false));
  if (level === undefined) throw new EditorError("invalid");
  const ids = categoryIds(form);
  if (ids.length && ids.length !== await tx.category.count({ where: { id: { in: ids } } })) throw new EditorError("invalid");
  await renameSlug(tx, courseId, slugValue(form));
  await tx.course.update({ where: { id: courseId }, data: { coverImage: cover, level } });
  await tx.courseCategory.deleteMany({ where: { courseId, ...(ids.length ? { categoryId: { notIn: ids } } : {}) } });
  if (ids.length) await tx.courseCategory.createMany({
    data: ids.map((categoryId) => ({ courseId, categoryId })), skipDuplicates: true,
  });
}

async function saveCommerce(tx: Transaction, courseId: string, form: FormData) {
  const mode = form.get("mode");
  if (typeof mode !== "string") {
    await tx.course.update({ where: { id: courseId }, data: { freeEnrollment: form.get("free") === "on" } });
    return;
  }
  if (mode !== "free" && mode !== "paid" && mode !== "closed") throw new EditorError("invalid");
  const listed = form.get("listed") === "on";
  if (mode !== "paid") {
    await tx.course.update({ where: { id: courseId }, data: { freeEnrollment: mode === "free", listed, priceRegular: null, priceSale: null } });
    return;
  }
  const priceRegular = readGel(value(form, "priceRegular", 16, false));
  const priceSale = readGel(value(form, "priceSale", 16, false));
  if (priceRegular === undefined || priceSale === undefined || priceRegular === null || (priceSale !== null && priceSale >= priceRegular)) {
    throw new EditorError("price");
  }
  await tx.course.update({ where: { id: courseId }, data: { freeEnrollment: false, listed, priceRegular, priceSale } });
}

async function publishCourse(tx: Transaction, courseId: string, published: boolean) {
  if (published) {
    const ready = await tx.course.findFirst({ where: { id: courseId, translations: { some: { locale: "ka" } },
      modules: { some: { archivedAt: null, items: { some: {
        kind: "LESSON", archivedAt: null, published: true, translations: { some: { locale: "ka" } },
      } } } },
    }, select: { id: true } });
    if (!ready) throw new EditorError("publish");
  }
  await tx.course.update({ where: { id: courseId }, data: { published } });
}

export async function mutateCourse(actorId: string, courseId: string, intent: string, locale: Locale, form: FormData) {
  if (!isId(courseId)) throw new EditorError("invalid");
  await db.$transaction(async (tx) => {
    const actor = await lockActor(tx, actorId);
    const scope = authorScope(actor);
    await tx.$queryRaw`SELECT id FROM app."Course" WHERE id = ${courseId}::uuid FOR UPDATE`;
    if (!await tx.course.findFirst({ where: { id: courseId, ...scope }, select: { id: true } }))
      throw new EditorError("denied");

    switch (intent) {
      case "course": {
        const translation = { title: value(form, "title", 180), description: parseText(value(form, "body", 16000, false)) };
        await tx.courseTranslation.upsert({ where: { courseId_locale: { courseId, locale } },
          update: translation, create: { courseId, locale, ...translation } });
        break;
      }
      case "basics":
        await saveBasics(tx, courseId, form);
        break;
      case "publish":
      case "unpublish":
        await publishCourse(tx, courseId, intent === "publish");
        break;
      case "access":
        if (actor.role !== "ADMIN") throw new EditorError("denied");
        await saveCommerce(tx, courseId, form);
        break;
      case "module-new": {
        const last = await tx.module.aggregate({ where: { courseId }, _max: { position: true } });
        await tx.module.create({ data: { courseId, position: (last._max.position ?? 0) + 1, titles: { ka: value(form, "title", 180) } } });
        break;
      }
      case "module-edit": {
        const courseModule = await requireModule(tx, identifier(form, "target"), courseId);
        await tx.module.update({ where: { id: courseModule.id }, data: { titles: { ...moduleTitles(courseModule.titles), [locale]: value(form, "title", 180) } } });
        break;
      }
      case "module-move":
      case "lesson-move":
        await reorder(tx, courseId, form, intent === "module-move");
        break;
      case "lesson-new": {
        const courseModule = await requireModule(tx, identifier(form, "target"), courseId);
        const last = await tx.learningItem.aggregate({ where: { moduleId: courseModule.id }, _max: { position: true } });
        await tx.learningItem.create({ data: { moduleId: courseModule.id, position: (last._max.position ?? 0) + 1,
          translations: { create: { locale: "ka", title: value(form, "title", 180), body: parseText(value(form, "body", 32000)) } } } });
        break;
      }
      case "lesson-edit": {
        const lesson = await requireLesson(tx, identifier(form, "target"), courseId);
        if (!moduleTitles(lesson.module.titles)[locale]) throw new EditorError("publish");
        const translation = { title: value(form, "title", 180), body: parseText(value(form, "body", 32000)) };
        const url = value(form, "video", 2000, false);
        const video = parseVideo(url);
        if (url && !video) throw new EditorError("video");
        await tx.learningItem.update({ where: { id: lesson.id }, data: {
          videoSource: video?.videoSource ?? null, videoRef: video?.videoRef ?? null,
          published: form.get("published") === "on", preview: form.get("preview") === "on",
          translations: { upsert: { where: { itemId_locale: { itemId: lesson.id, locale } },
            create: { locale, ...translation }, update: translation } },
        } });
        break;
      }
      case "asset": {
        const lesson = await requireLesson(tx, identifier(form, "target"), courseId);
        const file = form.get("file");
        if (!(file instanceof File) || !file.size || file.size > maxAssetSize) throw new EditorError("file");
        const name = file.name.split(/[\\/]/).pop()?.normalize("NFC") ?? "";
        if (!name || name.length > 180 || /[\p{C}]/u.test(name)) throw new EditorError("file");
        const data = new Uint8Array(await file.arrayBuffer());
        const type = detectAsset(data, name);
        if (!type) throw new EditorError("file");
        await tx.lessonAsset.create({ data: { itemId: lesson.id, objectKey: crypto.randomUUID(), data, sizeBytes: data.length, name, ...type } });
        break;
      }
      case "assign":
      case "enroll": {
        if (actor.role !== "ADMIN") throw new EditorError("denied");
        const userId = identifier(form, "userId");
        const target = await tx.appUser.findUnique({ where: { id: userId }, select: { role: true } });
        if (!target || (intent === "assign" && target.role !== "INSTRUCTOR")) throw new EditorError("invalid");
        if (intent === "assign") await tx.courseInstructor.upsert({ where: { courseId_userId: { courseId, userId } },
          create: { courseId, userId }, update: {} });
        else await tx.enrollment.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId }, update: {} });
        break;
      }
      default:
        throw new EditorError("invalid");
    }
  });
}

export async function mutateCategory(actorId: string, intent: string, form: FormData) {
  try {
    await db.$transaction(async (tx) => {
      const actor = await lockActor(tx, actorId);
      if (actor.role !== "ADMIN") throw new EditorError("denied");
      if (intent === "category-new") {
        const title = value(form, "title", 120);
        const english = value(form, "titleEn", 120, false);
        await tx.category.create({ data: {
          slug: slugValue(form),
          translations: { create: [{ locale: "ka", title }, ...(english ? [{ locale: "en", title: english }] : [])] },
        } });
        return;
      }
      const id = identifier(form, "target");
      if (intent === "category-edit") {
        const title = value(form, "title", 120);
        const english = value(form, "titleEn", 120, false);
        if (!await tx.category.findUnique({ where: { id }, select: { id: true } })) throw new EditorError("invalid");
        await tx.category.update({ where: { id }, data: { slug: slugValue(form) } });
        await tx.categoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: id, locale: "ka" } },
          update: { title }, create: { categoryId: id, locale: "ka", title },
        });
        if (english) await tx.categoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: id, locale: "en" } },
          update: { title: english }, create: { categoryId: id, locale: "en", title: english },
        });
        else await tx.categoryTranslation.deleteMany({ where: { categoryId: id, locale: "en" } });
        return;
      }
      if (intent === "category-delete") {
        if (!await tx.category.findUnique({ where: { id }, select: { id: true } })) throw new EditorError("invalid");
        if (await tx.courseCategory.count({ where: { categoryId: id } })) throw new EditorError("category");
        await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
        await tx.category.delete({ where: { id } });
        return;
      }
      throw new EditorError("invalid");
    });
  } catch (error) {
    if (uniqueConflict(error)) throw new EditorError("duplicate");
    throw error;
  }
}
