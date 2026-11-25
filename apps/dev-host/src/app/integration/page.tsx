import { LessonVideo } from "@kupragao/lms-ui";
import { openDevCourse, openDevLesson } from "../../cycle";
import { integrationActor } from "../../session";
import { getDb } from "../../db";
import {
  assignInstructorAction, completeAction, createCourseAction, enrollAction, publishCourseAction,
  saveAccessAction, saveBasicsAction, savePlanAction, selectActorAction,
} from "./actions";

export const dynamic = "force-dynamic";

const browserSlug = "dh-browser";

export default async function IntegrationPage() {
  if (process.env.LMS_DEV_HOST_MODE !== "integration") {
    return <main id="main"><p data-mode="integration-off">Integration mode is not running.</p></main>;
  }
  const actor = await integrationActor();
  const course = actor ? await getDb().course.findUnique({
    where: { slug: browserSlug },
    select: { id: true, slug: true, published: true, freeEnrollment: true },
  }) : null;
  const view = actor && course ? await openDevCourse(actor.id, course.slug) : null;
  const lesson = view?.modules[0]?.lessons[0];
  const opened = actor && course && lesson ? await openDevLesson(actor.id, course.slug, lesson.id) : null;
  return (
    <main id="main">
      <h1>LMS dev host integration</h1>
      <p data-mode="integration">Integration mode uses the isolated local database.</p>
      <p data-actor={actor?.role ?? "none"} data-access={actor ? "signed-in" : "missing"}>
        {actor ? actor.displayName : "No test actor"}
      </p>
      <form action={selectActorAction}>
        <button name="role" value="ADMIN" type="submit">Admin</button>
        <button name="role" value="INSTRUCTOR" type="submit">Instructor</button>
        <button name="role" value="STUDENT" type="submit">Student</button>
      </form>
      {actor?.role === "ADMIN" && !course ? (
        <form action={createCourseAction}>
          <input name="title" defaultValue="Browser course" />
          <input name="slug" defaultValue={browserSlug} />
          <button type="submit">Create course</button>
        </form>
      ) : null}
      {actor?.role === "ADMIN" && course ? (
        <>
          <form action={saveBasicsAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <input name="title" defaultValue="Browser course" />
            <input name="slug" defaultValue={course.slug} />
            <button type="submit">Save basics</button>
          </form>
          <form action={savePlanAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <input name="lessonTitle" defaultValue="Browser lesson" />
            <input name="lessonBody" defaultValue="Browser lesson body." />
            <input name="video" defaultValue="https://youtu.be/abcdefghijk" />
            <input name="hiddenTitle" defaultValue="Hidden lesson" />
            <input name="published" type="checkbox" defaultChecked />
            <button type="submit">Save plan</button>
          </form>
          <form action={saveAccessAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <button type="submit">Save access</button>
          </form>
          <form action={publishCourseAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <button type="submit">Publish</button>
          </form>
          <form action={assignInstructorAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <button type="submit">Assign instructor</button>
          </form>
        </>
      ) : null}
      {actor?.role === "STUDENT" && course ? (
        <form action={enrollAction}>
          <input type="hidden" name="slug" value={course.slug} />
          <button type="submit">Enroll</button>
        </form>
      ) : null}
      <section data-published={course?.published ? "yes" : "no"} data-progress={view?.percent ?? 0}>
        <h2>{view?.title ?? "No published course"}</h2>
        {opened ? (
          <>
            <div data-player="youtube">
              <LessonVideo source={opened.videoSource} reference={opened.videoRef} title={opened.current.title} />
            </div>
            <form action={completeAction}>
              <input type="hidden" name="slug" value={course?.slug ?? ""} />
              <input type="hidden" name="itemId" value={opened.current.id} />
              <button type="submit">Complete lesson</button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
