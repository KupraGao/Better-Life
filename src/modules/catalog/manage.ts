import { db } from "@/lib/db";
import { courseDb } from "@/modules/host/course-db";
import type { LearningLocale } from "@kupragao/lms-contracts";
import {
  createCourse as createCourseOn,
  mutateCategory as mutateCategoryOn,
  mutateCourse as mutateCourseOn,
  saveCourseAccess as saveCourseAccessOn,
  saveCourseBasics as saveCourseBasicsOn,
  saveCoursePlan as saveCoursePlanOn,
} from "@kupragao/lms-core";

export {
  accessStampFrom,
  authorScope,
  basicsStampFrom,
  EditorError,
  isId,
  moduleTitles,
  planStampFrom,
  type EditorPlan,
  type ErrorCode,
} from "@kupragao/lms-core";

export function createCourse(actorId: string, form: FormData) {
  return createCourseOn(db, courseDb, actorId, form);
}

export function saveCourseAccess(actorId: string, courseId: string, form: FormData) {
  return saveCourseAccessOn(db, courseDb, actorId, courseId, form);
}

export function saveCourseBasics(actorId: string, courseId: string, locale: LearningLocale, form: FormData) {
  return saveCourseBasicsOn(db, courseDb, actorId, courseId, locale, form);
}

export function saveCoursePlan(actorId: string, courseId: string, locale: LearningLocale, form: FormData) {
  return saveCoursePlanOn(db, courseDb, actorId, courseId, locale, form);
}

export function mutateCourse(actorId: string, courseId: string, intent: string, locale: LearningLocale, form: FormData) {
  return mutateCourseOn(db, courseDb, actorId, courseId, intent, locale, form);
}

export function mutateCategory(actorId: string, intent: string, form: FormData) {
  return mutateCategoryOn(db, courseDb, actorId, intent, form);
}
