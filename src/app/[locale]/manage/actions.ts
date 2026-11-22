"use server";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n";
import { createCourse, EditorError, isId, mutateCourse } from "@/modules/catalog/manage";
import { requireUser } from "@/modules/identity/session";

function editorCode(error: unknown) {
  if (error instanceof EditorError) return error.code;
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return "duplicate";
  throw error;
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

export async function editCourse(locale: string, courseId: string, edit: string, intent: string, form: FormData) {
  if (!isLocale(locale) || !isLocale(edit) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  const path = `/${locale}/manage/${courseId}`;
  let code = "saved";
  try {
    await mutateCourse(actor.id, courseId, intent, edit, form);
    revalidatePath(path);
  } catch (error) {
    code = editorCode(error);
  }
  redirect(`${path}?edit=${edit}&notice=${code}`);
}
