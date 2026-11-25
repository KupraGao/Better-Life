import { isLearningLocale } from "@kupragao/lms-contracts";
import { authorScope, EditorError, externalVideoFields, parseVideo, progressPercent, videoUrl } from "@kupragao/lms-core";
import { basicsChanged, newLesson, type BasicsDraft } from "@kupragao/lms-ui";
import { testActor, testActors } from "./actors";

const saved: BasicsDraft = {
  title: "Draft", body: "Body", slug: "draft", cover: "", level: "BEGINNER", categoryIds: [],
};

export function smokeSnapshot() {
  const parsed = parseVideo("https://youtu.be/abcdefghijk");
  return {
    locale: isLearningLocale("ka") && isLearningLocale("en") && !isLearningLocale("fr"),
    videoRef: parsed?.videoRef ?? "",
    videoCleared: externalVideoFields("")?.videoSource === null,
    embed: videoUrl("YOUTUBE", "abcdefghijk", true),
    progress: progressPercent(1, 2),
    hiddenLesson: newLesson("lesson").published === false,
    draftDirty: basicsChanged({ ...saved, title: "Changed" }, saved),
  };
}

export function actorAccess(value: string | undefined) {
  const actor = testActor(value);
  if (!actor) return { actor: null, allowed: false, code: "missing" };
  try {
    return { actor, allowed: true, scope: authorScope(actor) };
  } catch (error) {
    return { actor, allowed: false, code: error instanceof EditorError ? error.code : "error" };
  }
}

export const actorIds = {
  admin: testActors.ADMIN.id,
  instructor: testActors.INSTRUCTOR.id,
  student: testActors.STUDENT.id,
};
