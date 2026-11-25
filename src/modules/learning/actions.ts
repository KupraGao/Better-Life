"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { LearningStore } from "@/modules/host/store";
import { requireUser } from "@/modules/identity/session";
import { courseLocale, coursePath, lessonPath } from "./labels";
import { completeLesson, enrollForFree } from "./service";

async function commitLearningChange(operation: (tx: LearningStore) => Promise<boolean>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : null;
      if (attempt >= 3 || (code !== "P2034" && code !== "P2002")) throw error;
    }
  }
}

export async function enrollAction(language: string, slug: string) {
  const locale = courseLocale(language);
  const user = await requireUser(locale);
  const enrolled = await commitLearningChange((tx) => enrollForFree(tx, locale, slug, user.id));
  if (!enrolled) notFound();
  revalidatePath(`/${locale}/dashboard`);
  redirect(coursePath(locale, slug));
}

export async function completeAction(language: string, slug: string, itemId: string) {
  const locale = courseLocale(language);
  const user = await requireUser(locale);
  const completed = await commitLearningChange((tx) => completeLesson(tx, locale, slug, itemId, user.id));
  if (!completed) notFound();
  revalidatePath(coursePath(locale, slug));
  revalidatePath(`/${locale}/dashboard`);
  redirect(lessonPath(locale, slug, itemId));
}
