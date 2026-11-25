import { LessonVideo, RichText } from "@kupragao/lms-ui";
import Link from "next/link";
import { actorAccess, smokeSnapshot } from "../smoke";

export const dynamic = "force-dynamic";

const sample = { blocks: [
  { type: "paragraph" as const, text: "Smoke text" },
  { type: "bullet" as const, text: "Smoke item" },
] };

export default async function Home({ searchParams }: { searchParams: Promise<{ actor?: string }> }) {
  const actor = actorAccess((await searchParams).actor);
  const smoke = smokeSnapshot();
  return (
    <main id="main">
      <h1>LMS dev host</h1>
      <p data-mode="smoke">Smoke mode does not use a database.</p>
      <nav aria-label="Test actors">
        <Link href="/?actor=ADMIN">Admin</Link>
        <Link href="/?actor=INSTRUCTOR">Instructor</Link>
        <Link href="/?actor=STUDENT">Student</Link>
      </nav>
      <section>
        <h2>Package results</h2>
        <p data-smoke="video">{smoke.videoRef}</p>
        <p data-smoke="progress">{smoke.progress}</p>
        <p data-smoke="draft">{smoke.draftDirty ? "dirty" : "clean"}</p>
        <p data-smoke="hidden">{smoke.hiddenLesson ? "hidden" : "visible"}</p>
        <p data-actor={actor.actor?.role ?? "none"} data-access={actor.allowed ? "allowed" : actor.code}>
          {actor.actor ? `${actor.actor.displayName}` : "No test actor"}
        </p>
      </section>
      <section>
        <h2>Lesson content</h2>
        <RichText value={sample} />
        <div data-player="youtube"><LessonVideo source="YOUTUBE" reference={smoke.videoRef || null} title="Sample" /></div>
        <div data-player="empty"><LessonVideo source={null} reference={null} title="Empty" /></div>
      </section>
    </main>
  );
}
