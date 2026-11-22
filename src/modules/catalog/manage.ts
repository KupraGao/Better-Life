import type { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n";
import { db } from "@/lib/db";
import { parseText, parseVideo } from "./content";
import { detectAsset, maxAssetSize } from "../media/file-type";

type Transaction = Prisma.TransactionClient;
type Actor = { id: string; role: string };
export type ErrorCode = "invalid" | "denied" | "stale" | "publish" | "video" | "file" | "duplicate";
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
  const slug = value(form, "slug", 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new EditorError("invalid");
  return slug;
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
  const module = await tx.module.findFirst({ where: { id: moduleId, courseId, archivedAt: null } });
  if (!module) throw new EditorError("denied");
  return module;
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
      case "publish":
      case "unpublish":
        await publishCourse(tx, courseId, intent === "publish");
        break;
      case "access":
        if (actor.role !== "ADMIN") throw new EditorError("denied");
        await tx.course.update({ where: { id: courseId }, data: { freeEnrollment: form.get("free") === "on" } });
        break;
      case "module-new": {
        const last = await tx.module.aggregate({ where: { courseId }, _max: { position: true } });
        await tx.module.create({ data: { courseId, position: (last._max.position ?? 0) + 1, titles: { ka: value(form, "title", 180) } } });
        break;
      }
      case "module-edit": {
        const module = await requireModule(tx, identifier(form, "target"), courseId);
        await tx.module.update({ where: { id: module.id }, data: { titles: { ...moduleTitles(module.titles), [locale]: value(form, "title", 180) } } });
        break;
      }
      case "module-move":
      case "lesson-move":
        await reorder(tx, courseId, form, intent === "module-move");
        break;
      case "lesson-new": {
        const module = await requireModule(tx, identifier(form, "target"), courseId);
        const last = await tx.learningItem.aggregate({ where: { moduleId: module.id }, _max: { position: true } });
        await tx.learningItem.create({ data: { moduleId: module.id, position: (last._max.position ?? 0) + 1,
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
