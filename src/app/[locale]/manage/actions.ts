"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n";
import { createCourse, EditorError, type EditorPlan, isId, mutateCategory, mutateCourse, saveCourseAccess, saveCourseBasics, saveCoursePlan } from "@/modules/catalog/manage";
import { requireUser } from "@/modules/identity/session";

function editorCode(error: unknown) {
  if (error instanceof EditorError) return error.code;
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return "duplicate";
  throw error;
}

export type EditorResult = { ok: true; stamp: string; plan?: EditorPlan } | { ok: false; code: string };

async function savedResult(locale: string, courseId: string, run: () => Promise<{ stamp: string; plan?: EditorPlan }>): Promise<EditorResult> {
  try {
    const saved = await run();
    revalidatePath(`/${locale}/manage/${courseId}`);
    revalidatePath(`/${locale}/courses`);
    return { ok: true, stamp: saved.stamp, plan: saved.plan };
  } catch (error) {
    return { ok: false, code: editorCode(error) };
  }
}

export async function saveBasicsAction(locale: string, courseId: string, edit: string, form: FormData) {
  if (!isLocale(locale) || !isLocale(edit) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  return savedResult(locale, courseId, async () => ({ stamp: await saveCourseBasics(actor.id, courseId, edit, form) }));
}

export async function savePlanAction(locale: string, courseId: string, edit: string, form: FormData) {
  if (!isLocale(locale) || !isLocale(edit) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  return savedResult(locale, courseId, () => saveCoursePlan(actor.id, courseId, edit, form));
}

export async function saveAccessAction(locale: string, courseId: string, form: FormData) {
  if (!isLocale(locale) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  return savedResult(locale, courseId, async () => ({ stamp: await saveCourseAccess(actor.id, courseId, form) }));
}

export async function addCourse(locale: string, form: FormData) {
  if (!isLocale(locale)) notFound();
  const actor = await requireUser(locale);
  let path = `/${locale}/manage`;
  try {
    const course = await createCourse(actor.id, form);
    revalidatePath(path);
    path += `/${course.id}?edit=ka&notice=saved`;
  } catch (error) {
    path += `?notice=${editorCode(error)}`;
  }
  redirect(path);
}

function editorTab(form: FormData) {
  const tab = form.get("tab");
  return tab === "plan" || tab === "access" || tab === "basics" ? tab : "basics";
}

const retiredEditorIntents = new Set([
  "course",
  "basics",
  "access",
  "module-new",
  "module-edit",
  "module-move",
  "lesson-new",
  "lesson-edit",
  "lesson-move",
  "asset",
  "asset-replace",
  "asset-delete",
]);

export async function editCourse(locale: string, courseId: string, edit: string, intent: string, form: FormData) {
  if (!isLocale(locale) || !isLocale(edit) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  const path = `/${locale}/manage/${courseId}`;
  if (retiredEditorIntents.has(intent)) {
    redirect(`${path}?edit=${edit}&tab=${editorTab(form)}&notice=invalid`);
  }
  let code = "saved";
  try {
    await mutateCourse(actor.id, courseId, intent, edit, form);
    revalidatePath(path);
    revalidatePath(`/${locale}/courses`);
  } catch (error) {
    code = editorCode(error);
  }
  redirect(`${path}?edit=${edit}&tab=${editorTab(form)}&notice=${code}`);
}

export async function saveCategory(locale: string, intent: string, form: FormData) {
  if (!isLocale(locale)) notFound();
  const actor = await requireUser(locale);
  const path = `/${locale}/manage`;
  let code = "saved";
  try {
    await mutateCategory(actor.id, intent, form);
    revalidatePath(path);
    revalidatePath(`/${locale}/courses`);
  } catch (error) {
    code = editorCode(error);
  }
  redirect(`${path}?notice=${code}`);
}
