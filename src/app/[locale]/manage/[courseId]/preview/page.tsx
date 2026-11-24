import { notFound } from "next/navigation";
import { isLocale } from "@/i18n";
import { db } from "@/lib/db";
import { isId } from "@/modules/catalog/manage";
import { requireUser } from "@/modules/identity/session";
import { AdminPreview } from "@/modules/learning/admin-preview";
import { readAdminPreview } from "@/modules/learning/service";

export const dynamic = "force-dynamic";

export default async function CoursePreview({ params, searchParams }: {
  params: Promise<{ locale: string; courseId: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const { locale, courseId } = await params;
  const query = await searchParams;
  const editValue = Array.isArray(query.edit) ? query.edit[0] : query.edit;
  if (!isLocale(locale) || !isId(courseId)) notFound();
  const actor = await requireUser(locale);
  if (actor.role !== "ADMIN") notFound();
  const edit = editValue && isLocale(editValue) ? editValue : locale;
  const course = await db.$transaction((tx) => readAdminPreview(tx, edit, courseId, actor));
  if (!course) notFound();
  return <AdminPreview locale={locale} course={course} />;
}
