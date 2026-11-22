import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import pg from "pg";

// Local editorial sample. Never import visitor data or overwrite an edited course on restart.
const config = parseEnv(await readFile(".local/db/env", "utf8"));
const local = new URL(config.DIRECT_URL);
if (local.hostname !== "127.0.0.1" || local.port !== "55432" || local.pathname !== "/betterlife") {
  throw new Error("Use the local Better Life database for sample content.");
}
const db = new pg.Client({ connectionString: local.href });
const blocks = (text) => JSON.stringify({ blocks: [{ type: "paragraph", text }] });
const courseId = "10100000-0000-4000-8000-000000000001";
const moduleId = "10100000-0000-4000-8000-000000000002";
const lessons = [
  {
    id: "10100000-0000-4000-8000-000000000003",
    ka: ["შენი სასწავლო კაბინეტი", "კურსზე ჩაწერის შემდეგ კაბინეტში გამოჩნდება კურსი და გავლილი გაკვეთილების რაოდენობა. იქიდან შეგიძლია სწავლას დაუბრუნდე."],
    en: ["Your learning dashboard", "After you enroll, your dashboard lists the course and the number of lessons you have completed. Return to it whenever you want to resume learning."],
  },
  {
    id: "10100000-0000-4000-8000-000000000004",
    ka: ["პროგრესის შენახვა", "მასალის გაცნობის შემდეგ მონიშნე გაკვეთილი დასრულებულად. გახსენი კაბინეტი და შეამოწმე, როგორ აისახა შედეგი შენს პროგრესზე."],
    en: ["Saving your progress", "When you have finished reading, mark the lesson complete. Open your dashboard to see your updated course progress."],
  },
];
await db.connect();
try {
  await db.query("BEGIN");
  const course = await db.query(`
    INSERT INTO app."Course" (id, slug, published, "freeEnrollment")
    VALUES ($1, 'getting-started', true, true) ON CONFLICT DO NOTHING RETURNING id
  `, [courseId]);
  if (course.rowCount) {
    for (const [locale, title, description] of [
      ["ka", "პირველი ნაბიჯები აკადემიაში", "უფასო საცდელი კურსი. გაიცანი სასწავლო კაბინეტი და გამოცადე პროგრესის შენახვა."],
      ["en", "Getting started at the academy", "A free sample course. Explore your learning dashboard and try saving your progress."],
    ]) {
      await db.query('INSERT INTO app."CourseTranslation" (id,"courseId",locale,title,description) VALUES (gen_random_uuid(),$1,$2,$3,$4)', [courseId, locale, title, blocks(description)]);
    }
    await db.query('INSERT INTO app."Module" (id,"courseId",position,titles) VALUES ($1,$2,1,$3)', [
      moduleId, courseId, { ka: "სწავლის დაწყება", en: "Start learning" },
    ]);
    for (const [index, lesson] of lessons.entries()) {
      await db.query('INSERT INTO app."LearningItem" (id,"moduleId",position,published) VALUES ($1,$2,$3,true)', [lesson.id, moduleId, index + 1]);
      for (const locale of ["ka", "en"]) {
        const [title, body] = lesson[locale];
        await db.query('INSERT INTO app."ItemTranslation" (id,"itemId",locale,title,body) VALUES (gen_random_uuid(),$1,$2,$3,$4)', [lesson.id, locale, title, blocks(body)]);
      }
    }
  }
  await db.query("COMMIT");
  console.log(course.rowCount ? "Created bilingual sample course /courses/getting-started." : "Sample already exists; retained current content.");
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
