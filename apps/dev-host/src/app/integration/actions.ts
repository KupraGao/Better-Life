"use server";

import { revalidatePath } from "next/cache";
import {
  addDevAsset, assignDevInstructor, completeDevLesson, createDevCourse, enrollDevStudent,
  publishDevCourse, saveDevAccess, saveDevBasics, saveDevPlan,
} from "../../cycle";
import { integrationActor, selectTestActor } from "../../session";
import { testActors } from "../../actors";

async function actorId() {
  const actor = await integrationActor();
  if (!actor) throw new Error("test actor is missing");
  return actor.id;
}

export async function selectActorAction(formData: FormData) {
  const role = formData.get("role");
  if (role !== "ADMIN" && role !== "INSTRUCTOR" && role !== "STUDENT") {
    throw new Error("test actor is missing");
  }
  await selectTestActor(role);
  revalidatePath("/integration");
}

export async function createCourseAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");
  await createDevCourse(await actorId(), slug, title);
  revalidatePath("/integration");
}

export async function saveBasicsAction(formData: FormData) {
  await saveDevBasics(await actorId(), String(formData.get("courseId") ?? ""), String(formData.get("slug") ?? ""), String(formData.get("title") ?? ""));
  revalidatePath("/integration");
}

export async function savePlanAction(formData: FormData) {
  await saveDevPlan(await actorId(), String(formData.get("courseId") ?? ""), {
    title: String(formData.get("lessonTitle") ?? ""),
    body: String(formData.get("lessonBody") ?? ""),
    video: String(formData.get("video") ?? ""),
    published: formData.get("published") === "on",
  }, { title: String(formData.get("hiddenTitle") ?? "Hidden lesson") });
  revalidatePath("/integration");
}

export async function saveAccessAction(formData: FormData) {
  await saveDevAccess(await actorId(), String(formData.get("courseId") ?? ""));
  revalidatePath("/integration");
}

export async function publishCourseAction(formData: FormData) {
  await publishDevCourse(await actorId(), String(formData.get("courseId") ?? ""));
  revalidatePath("/integration");
}

export async function assignInstructorAction(formData: FormData) {
  await assignDevInstructor(await actorId(), String(formData.get("courseId") ?? ""), testActors.INSTRUCTOR.id);
  revalidatePath("/integration");
}

export async function enrollAction(formData: FormData) {
  await enrollDevStudent(await actorId(), String(formData.get("slug") ?? ""));
  revalidatePath("/integration");
}

export async function completeAction(formData: FormData) {
  await completeDevLesson(await actorId(), String(formData.get("slug") ?? ""), String(formData.get("itemId") ?? ""));
  revalidatePath("/integration");
}

export async function assetAction(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("file");
  await addDevAsset(await actorId(), String(formData.get("courseId") ?? ""), String(formData.get("lessonId") ?? ""), file);
  revalidatePath("/integration");
}
