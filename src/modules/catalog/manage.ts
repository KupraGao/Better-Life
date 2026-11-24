import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Locale } from "@/i18n";
import { db } from "@/lib/db";
import { normalizeSlug, readCover, readGel, readLevel } from "./basics";
import { authorText, parseText, parseVideo, videoUrl } from "./content";
import { assetFailure, detectAsset, maxAssetSize } from "../media/file-type";

type Transaction = Prisma.TransactionClient;
type Actor = { id: string; role: string };
export type ErrorCode = "invalid" | "denied" | "stale" | "publish" | "video" | "file" | "file-size" | "duplicate" | "price" | "cover" | "category";
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

async function readUpload(form: FormData, field = "file") {
  const file = form.get(field);
  if (!(file instanceof File)) throw new EditorError("file");
  if (file.size > maxAssetSize) throw new EditorError("file-size");
  if (!file.size) throw new EditorError("file");
  const name = file.name.split(/[\\/]/).pop()?.normalize("NFC") ?? "";
  if (!name || name.length > 180 || /[\p{C}]/u.test(name)) throw new EditorError("file");
  const data = new Uint8Array(await file.arrayBuffer());
  const failure = assetFailure(data, name);
  if (failure === "size") throw new EditorError("file-size");
  const type = failure ? null : detectAsset(data, name);
  if (!type) throw new EditorError("file");
  return { data, sizeBytes: data.length, name, mimeType: type.mimeType, kind: type.kind };
}

async function requireOwnedAsset(tx: Transaction, assetId: string, itemId: string) {
  const asset = await tx.lessonAsset.findFirst({ where: { id: assetId, itemId }, select: { id: true } });
  if (!asset) throw new EditorError("denied");
  return asset;
}

export function moduleTitles(value: unknown): Partial<Record<Locale, string>> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([k,v]) => (k === "ka" || k === "en") && typeof v === "string"));
}

function contentStamp(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function basicsStampFrom(course: {
  slug: string; coverImage: string | null; level: string | null;
  categories: { categoryId: string }[];
  translations: { locale: string; title: string; description: unknown }[];
}) {
  return contentStamp({
    slug: course.slug,
    coverImage: course.coverImage,
    level: course.level,
    categories: course.categories.map((row) => row.categoryId).sort(),
    translations: course.translations.map((row) => ({ locale: row.locale, title: row.title, description: row.description }))
      .sort((left, right) => left.locale.localeCompare(right.locale)),
  });
}

export function accessStampFrom(course: {
  freeEnrollment: boolean; listed: boolean; priceRegular: number | null; priceSale: number | null;
}) {
  return contentStamp({
    freeEnrollment: course.freeEnrollment, listed: course.listed,
    priceRegular: course.priceRegular, priceSale: course.priceSale,
  });
}

export function planStampFrom(modules: {
  id: string; titles: unknown;
  items: {
    id: string; published: boolean; videoSource: string | null; videoRef: string | null;
    translations: { locale: string; title: string; body: unknown }[];
    assets: { id: string }[];
  }[];
}[]) {
  return contentStamp(modules.map((courseModule) => ({
    id: courseModule.id,
    titles: moduleTitles(courseModule.titles),
    lessons: courseModule.items.map((lesson) => ({
      id: lesson.id,
      published: lesson.published,
      videoSource: lesson.videoSource,
      videoRef: lesson.videoRef,
      translations: lesson.translations.map((row) => ({ locale: row.locale, title: row.title, body: row.body }))
        .sort((left, right) => left.locale.localeCompare(right.locale)),
      assets: lesson.assets.map((asset) => asset.id).sort(),
    })),
  })));
}

function sameStamp(form: FormData, expected: string) {
  const stamp = form.get("stamp");
  if (typeof stamp !== "string" || stamp !== expected) throw new EditorError("stale");
}

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

async function assertBasicsStamp(tx: Transaction, courseId: string, form: FormData) {
  sameStamp(form, basicsStampFrom(await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: basicsSelect })));
}

async function assertAccessStamp(tx: Transaction, courseId: string, form: FormData) {
  sameStamp(form, accessStampFrom(await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: accessSelect })));
}

async function assertPlanStamp(tx: Transaction, courseId: string, form: FormData) {
  sameStamp(form, planStampFrom(await tx.module.findMany({
    where: { courseId, archivedAt: null }, orderBy: { position: "asc" }, select: planSelect,
  })));
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

async function withCourse<T>(actorId: string, courseId: string, run: (tx: Transaction, actor: Actor) => Promise<T>) {
  if (!isId(courseId)) throw new EditorError("invalid");
  return db.$transaction(async (tx) => {
    const actor = await lockActor(tx, actorId);
    await tx.$queryRaw`SELECT id FROM app."Course" WHERE id = ${courseId}::uuid FOR UPDATE`;
    if (!await tx.course.findFirst({ where: { id: courseId, ...authorScope(actor) }, select: { id: true } }))
      throw new EditorError("denied");
    return run(tx, actor);
  });
}

export async function saveCourseAccess(actorId: string, courseId: string, form: FormData) {
  return withCourse(actorId, courseId, async (tx, actor) => {
    if (actor.role !== "ADMIN") throw new EditorError("denied");
    await assertAccessStamp(tx, courseId, form);
    await saveCommerce(tx, courseId, form);
    return accessStampFrom(await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: accessSelect }));
  });
}

export async function saveCourseBasics(actorId: string, courseId: string, locale: Locale, form: FormData) {
  const title = value(form, "title", 180);
  const description = parseText(value(form, "body", 16000, false));
  return withCourse(actorId, courseId, async (tx) => {
    await assertBasicsStamp(tx, courseId, form);
    await tx.courseTranslation.upsert({
      where: { courseId_locale: { courseId, locale } },
      update: { title, description },
      create: { courseId, locale, title, description },
    });
    await saveBasics(tx, courseId, form);
    return basicsStampFrom(await tx.course.findUniqueOrThrow({ where: { id: courseId }, select: basicsSelect }));
  });
}

type PlanAssetInput = { key: string; id: string | null; action: "keep" | "delete" | "replace" | "create" };
type PlanLessonInput = {
  key: string; id: string | null; title: string; body: string; videoSource: "YOUTUBE" | "VIMEO" | null; videoRef: string | null;
  published: boolean | undefined; remove: boolean; assets: PlanAssetInput[];
};
type PlanModuleInput = { key: string; id: string | null; title: string; remove: boolean; lessons: PlanLessonInput[] };

function planText(value: unknown, max: number, required: boolean) {
  if (typeof value !== "string") throw new EditorError("invalid");
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new EditorError("invalid");
  return text;
}

function planKey(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9:-]{1,80}$/.test(value)) throw new EditorError("invalid");
  return value;
}

function planBoolean(source: object, key: string) {
  if (!(key in source)) return undefined;
  const flag = Reflect.get(source, key);
  if (typeof flag !== "boolean") throw new EditorError("invalid");
  return flag;
}

function planId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !isId(value)) throw new EditorError("invalid");
  return value;
}

function readPlan(form: FormData): PlanModuleInput[] {
  const raw = form.get("plan");
  if (typeof raw !== "string" || raw.length > 500_000) throw new EditorError("invalid");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new EditorError("invalid"); }
  if (!parsed || typeof parsed !== "object" || !("modules" in parsed) || !Array.isArray(parsed.modules) || parsed.modules.length > 80)
    throw new EditorError("invalid");
  return parsed.modules.map((courseModule) => {
    if (!courseModule || typeof courseModule !== "object") throw new EditorError("invalid");
    const id = planId("id" in courseModule ? courseModule.id : undefined);
    const remove = planBoolean(courseModule, "remove") === true;
    if (remove && !id) throw new EditorError("invalid");
    if (!("lessons" in courseModule) || !Array.isArray(courseModule.lessons) || courseModule.lessons.length > 80)
      throw new EditorError("invalid");
    return {
      key: planKey("key" in courseModule ? courseModule.key : undefined),
      id,
      title: planText("title" in courseModule ? courseModule.title : undefined, 180, !remove && !id),
      remove,
      lessons: courseModule.lessons.map((lesson: unknown) => {
        if (!lesson || typeof lesson !== "object") throw new EditorError("invalid");
        const lessonId = planId("id" in lesson ? lesson.id : undefined);
        const lessonRemove = planBoolean(lesson, "remove") === true;
        if (lessonRemove && !lessonId) throw new EditorError("invalid");
        const video = planText("video" in lesson ? lesson.video : undefined, 2000, false);
        const parsed = video ? parseVideo(video) : null;
        if (video && !parsed) throw new EditorError("video");
        if (!("assets" in lesson) || !Array.isArray(lesson.assets) || lesson.assets.length > 30) throw new EditorError("invalid");
        return {
          key: planKey("key" in lesson ? lesson.key : undefined),
          id: lessonId,
          title: planText("title" in lesson ? lesson.title : undefined, 180, !lessonRemove && !lessonId),
          body: planText("body" in lesson ? lesson.body : undefined, 32000, !lessonRemove && !lessonId),
          videoSource: parsed?.videoSource ?? null,
          videoRef: parsed?.videoRef ?? null,
          published: planBoolean(lesson, "published"),
          remove: lessonRemove,
          assets: lesson.assets.map((asset: unknown) => {
            if (!asset || typeof asset !== "object") throw new EditorError("invalid");
            const assetId = "id" in asset ? asset.id : undefined;
            if (assetId !== null && (typeof assetId !== "string" || !isId(assetId))) throw new EditorError("invalid");
            const action = "action" in asset ? asset.action : undefined;
            if (action !== "keep" && action !== "delete" && action !== "replace" && action !== "create") throw new EditorError("invalid");
            if ((action === "create") !== (assetId === null)) throw new EditorError("invalid");
            return { key: planKey("key" in asset ? asset.key : undefined), id: assetId, action };
          }),
        };
      }),
    };
  });
}

async function placeIds(ids: string[], positions: number[], ceiling: number, update: (id: string, position: number) => Promise<unknown>) {
  if (ids.length !== positions.length || ids.some((id) => !isId(id))) throw new EditorError("invalid");
  for (const [index, id] of ids.entries()) await update(id, ceiling + index + 1);
  const slots = positions.slice().sort((left, right) => left - right);
  for (const [index, id] of ids.entries()) await update(id, slots[index]);
}

export type EditorPlan = {
  modules: {
    key: string; id: string; title: string; fallbackTitle: string; remove: false;
    lessons: {
      key: string; id: string; title: string; body: string; video: string; published: boolean; remove: false;
      assets: { key: string; id: string; name: string; mimeType: string; sizeBytes: number; kind: "IMAGE" | "ATTACHMENT"; action: "keep" }[];
    }[];
  }[];
};

async function loadEditorPlan(tx: Transaction, courseId: string, locale: Locale): Promise<EditorPlan> {
  const modules = await tx.module.findMany({
    where: { courseId, archivedAt: null }, orderBy: { position: "asc" },
    select: {
      id: true, titles: true,
      items: { where: { kind: "LESSON", archivedAt: null }, orderBy: { position: "asc" }, select: {
        id: true, published: true, videoSource: true, videoRef: true, translations: true,
        assets: { orderBy: { id: "asc" }, select: { id: true, name: true, mimeType: true, sizeBytes: true, kind: true } },
      } },
    },
  });
  return { modules: modules.map((courseModule) => {
    const names = moduleTitles(courseModule.titles);
    return {
      key: courseModule.id, id: courseModule.id, title: names[locale] ?? "",
      fallbackTitle: ((locale === "ka" ? names.en : names.ka) ?? "").trim(), remove: false,
      lessons: courseModule.items.map((lesson) => {
        const text = lesson.translations.find((row) => row.locale === locale);
        return {
          key: lesson.id, id: lesson.id, title: text?.title ?? "", body: authorText(text?.body),
          video: videoUrl(lesson.videoSource, lesson.videoRef) ?? "", published: lesson.published, remove: false,
          assets: lesson.assets.map((file) => ({
            key: file.id, id: file.id, name: file.name, mimeType: file.mimeType, sizeBytes: file.sizeBytes, kind: file.kind, action: "keep" as const,
          })),
        };
      }),
    };
  }) };
}

export async function saveCoursePlan(actorId: string, courseId: string, locale: Locale, form: FormData) {
  const plan = readPlan(form);
  const keys = plan.flatMap((courseModule) => [courseModule.key, ...courseModule.lessons.flatMap((lesson) => [lesson.key, ...lesson.assets.map((asset) => asset.key)])]);
  if (new Set(keys).size !== keys.length) throw new EditorError("invalid");
  return withCourse(actorId, courseId, async (tx) => {
    await assertPlanStamp(tx, courseId, form);
    const modules = await tx.module.findMany({
      where: { courseId },
      select: { id: true, position: true, archivedAt: true, titles: true, items: {
        select: { id: true, position: true, archivedAt: true, kind: true, assets: { select: { id: true } } },
      } },
    });
    const activeModules = modules.filter((courseModule) => !courseModule.archivedAt);
    const existingModules = plan.filter((courseModule) => courseModule.id);
    if (existingModules.length !== activeModules.length || new Set(existingModules.map((courseModule) => courseModule.id)).size !== existingModules.length)
      throw new EditorError("stale");
    for (const courseModule of existingModules) {
      if (!activeModules.some((row) => row.id === courseModule.id)) throw new EditorError("stale");
      const stored = activeModules.find((row) => row.id === courseModule.id);
      const activeLessons = stored?.items.filter((item) => !item.archivedAt && item.kind === "LESSON") ?? [];
      const existingLessons = courseModule.lessons.filter((lesson) => lesson.id);
      if (existingLessons.length !== activeLessons.length || new Set(existingLessons.map((lesson) => lesson.id)).size !== existingLessons.length)
        throw new EditorError("stale");
      for (const lesson of existingLessons) {
        const storedLesson = activeLessons.find((item) => item.id === lesson.id);
        if (!storedLesson) throw new EditorError("stale");
        const storedAssets = new Set(storedLesson.assets.map((asset) => asset.id));
        const incomingAssets = lesson.assets.filter((asset) => asset.id);
        if (incomingAssets.length !== storedAssets.size || incomingAssets.some((asset) => !asset.id || !storedAssets.has(asset.id)))
          throw new EditorError("stale");
      }
      if (courseModule.lessons.some((lesson) => !lesson.id && lesson.assets.some((asset) => asset.action !== "create")))
        throw new EditorError("invalid");
    }
    if (plan.some((courseModule) => !courseModule.id && courseModule.lessons.some((lesson) => lesson.id))) throw new EditorError("invalid");

    const uploads = new Map<string, Awaited<ReturnType<typeof readUpload>>>();
    for (const courseModule of plan) {
      if (courseModule.remove) continue;
      for (const lesson of courseModule.lessons) {
        if (lesson.remove) continue;
        for (const asset of lesson.assets) {
          if (asset.action === "replace" || asset.action === "create") uploads.set(asset.key, await readUpload(form, `file:${asset.key}`));
        }
      }
    }

    const moduleIds = new Map<string, string>();
    let nextModulePosition = Math.max(0, ...modules.map((courseModule) => courseModule.position)) + 1;
    const archivedAt = new Date();
    for (const courseModule of plan) {
      if (courseModule.id && courseModule.remove) {
        moduleIds.set(courseModule.key, courseModule.id);
        await tx.module.updateMany({ where: { id: courseModule.id, archivedAt: null }, data: { archivedAt } });
        continue;
      }
      if (courseModule.id) {
        moduleIds.set(courseModule.key, courseModule.id);
        const stored = modules.find((row) => row.id === courseModule.id);
        const titles = moduleTitles(stored?.titles);
        await tx.module.update({ where: { id: courseModule.id }, data: {
          titles: courseModule.title ? { ...titles, [locale]: courseModule.title } : titles,
        } });
      } else {
        const created = await tx.module.create({ data: {
          courseId, position: nextModulePosition++, titles: { [locale]: courseModule.title },
        } });
        moduleIds.set(courseModule.key, created.id);
      }
    }

    const lessonIds = new Map<string, string>();
    for (const courseModule of plan) {
      if (courseModule.remove) continue;
      const moduleId = moduleIds.get(courseModule.key);
      if (!moduleId) throw new EditorError("invalid");
      const storedItems = modules.find((row) => row.id === courseModule.id)?.items ?? [];
      let nextLessonPosition = Math.max(0, ...storedItems.map((item) => item.position)) + 1;
      for (const lesson of courseModule.lessons) {
        if (lesson.id && lesson.remove) {
          lessonIds.set(lesson.key, lesson.id);
          await tx.learningItem.updateMany({ where: { id: lesson.id, archivedAt: null }, data: { archivedAt } });
          continue;
        }
        const video = { videoSource: lesson.videoSource, videoRef: lesson.videoRef };
        if ((lesson.title.length > 0) !== (lesson.body.length > 0)) throw new EditorError("invalid");
        const translation = { title: lesson.title, body: parseText(lesson.body) };
        const writeTranslation = lesson.title.length > 0;
        if (lesson.id) {
          lessonIds.set(lesson.key, lesson.id);
          await tx.learningItem.update({ where: { id: lesson.id }, data: {
            ...video,
            ...(typeof lesson.published === "boolean" ? { published: lesson.published } : {}),
            ...(writeTranslation ? { translations: { upsert: {
              where: { itemId_locale: { itemId: lesson.id, locale } }, create: { locale, ...translation }, update: translation,
            } } } : {}),
          } });
        } else {
          const created = await tx.learningItem.create({ data: {
            moduleId, position: nextLessonPosition++, ...video, preview: false,
            published: lesson.published === true,
            translations: { create: { locale, ...translation } },
          } });
          lessonIds.set(lesson.key, created.id);
        }
      }
    }

    const modulePositions = [
      ...activeModules.map((courseModule) => courseModule.position),
      ...plan.filter((courseModule) => !courseModule.id).map((_, index) => Math.max(0, ...modules.map((courseModule) => courseModule.position)) + 1 + index),
    ];
    await placeIds(plan.map((courseModule) => moduleIds.get(courseModule.key) ?? ""), modulePositions, nextModulePosition, (id, position) =>
      tx.module.update({ where: { id }, data: { position }, select: { id: true } }));

    for (const courseModule of plan) {
      if (courseModule.remove) continue;
      const moduleId = moduleIds.get(courseModule.key);
      if (!moduleId) throw new EditorError("invalid");
      const storedItems = modules.find((row) => row.id === courseModule.id)?.items ?? [];
      const lessonPositions = storedItems.filter((item) => !item.archivedAt && item.kind === "LESSON").map((item) => item.position);
      const createdCount = courseModule.lessons.filter((lesson) => !lesson.id).length;
      const start = Math.max(0, ...storedItems.map((item) => item.position)) + 1;
      await placeIds(
        courseModule.lessons.map((lesson) => lessonIds.get(lesson.key) ?? ""),
        [...lessonPositions, ...Array.from({ length: createdCount }, (_, index) => start + index)],
        Math.max(0, ...storedItems.map((item) => item.position), 0) + createdCount + 1,
        (id, position) => tx.learningItem.update({ where: { id }, data: { position }, select: { id: true } }),
      );
      for (const lesson of courseModule.lessons) {
        if (lesson.remove) continue;
        const itemId = lessonIds.get(lesson.key);
        if (!itemId) throw new EditorError("invalid");
        for (const asset of lesson.assets) {
          if (asset.action === "keep") continue;
          if (asset.action === "delete") {
            const removed = await tx.lessonAsset.deleteMany({ where: { id: asset.id ?? "", itemId } });
            if (removed.count !== 1) throw new EditorError("denied");
            continue;
          }
          const upload = uploads.get(asset.key);
          if (!upload) throw new EditorError("file");
          if (asset.action === "create") {
            await tx.lessonAsset.create({ data: { itemId, objectKey: crypto.randomUUID(), ...upload } });
          } else {
            const saved = await tx.lessonAsset.updateMany({ where: { id: asset.id ?? "", itemId }, data: upload });
            if (saved.count !== 1) throw new EditorError("denied");
          }
        }
      }
    }
    return {
      stamp: planStampFrom(await tx.module.findMany({
        where: { courseId, archivedAt: null }, orderBy: { position: "asc" }, select: planSelect,
      })),
      plan: await loadEditorPlan(tx, courseId, locale),
    };
  });
}

export async function mutateCourse(actorId: string, courseId: string, intent: string, locale: Locale, form: FormData) {
  await withCourse(actorId, courseId, async (tx, actor) => {
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
        await tx.lessonAsset.create({ data: { itemId: lesson.id, objectKey: crypto.randomUUID(), ...await readUpload(form) } });
        break;
      }
      case "asset-replace": {
        const lesson = await requireLesson(tx, identifier(form, "target"), courseId);
        const asset = await requireOwnedAsset(tx, identifier(form, "asset"), lesson.id);
        const next = await readUpload(form);
        const saved = await tx.lessonAsset.updateMany({ where: { id: asset.id, itemId: lesson.id }, data: next });
        if (saved.count !== 1) throw new EditorError("denied");
        break;
      }
      case "asset-delete": {
        const lesson = await requireLesson(tx, identifier(form, "target"), courseId);
        const removed = await tx.lessonAsset.deleteMany({ where: { id: identifier(form, "asset"), itemId: lesson.id } });
        if (removed.count !== 1) throw new EditorError("denied");
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
