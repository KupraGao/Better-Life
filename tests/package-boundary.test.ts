// Repeat with: npx tsx --test tests/package-boundary.test.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isLearningLocale } from "@kupragao/lms-contracts";
import { authorScope, parseVideo, progressPercent } from "@kupragao/lms-core";
import { basicsChanged, LessonVideo, RichText } from "@kupragao/lms-ui";
import { authorScope as hostScope } from "../src/modules/catalog/editor";
import { parseVideo as hostVideo } from "../src/modules/catalog/external-video";
import { progressPercent as hostProgress } from "../src/modules/learning/service";
import { LessonVideo as hostVideoView, RichText as hostRichText } from "../src/modules/catalog/lesson-content";
import { detectAsset as hostDetect } from "../src/modules/media/file-type";
import { basicsChanged as hostBasicsChanged } from "../src/app/[locale]/manage/draft.ts";
import { detectAsset } from "@kupragao/lms-core";

function packageSources(root: string) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) return packageSources(path);
    if (name.endsWith(".map")) return [];
    return name.endsWith(".js") || name.endsWith(".d.ts") ? [path] : [];
  });
}

test("package public exports", () => {
  assert.equal(isLearningLocale("ka"), true);
  assert.equal(isLearningLocale("en"), true);
  assert.equal(progressPercent(1, 2), 50);
  assert.equal(parseVideo("https://youtu.be/abcdefghijk")?.videoSource, "YOUTUBE");
  assert.equal(parseVideo(""), null);
  assert.equal(typeof RichText, "function");
  assert.equal(typeof LessonVideo, "function");
  assert.deepEqual(authorScope({ id: "admin", role: "ADMIN" }), { archivedAt: null });
});

test("package dependency boundaries", () => {
  const contracts = JSON.parse(readFileSync("node_modules/@kupragao/lms-contracts/package.json", "utf8"));
  const core = JSON.parse(readFileSync("node_modules/@kupragao/lms-core/package.json", "utf8"));
  const ui = JSON.parse(readFileSync("node_modules/@kupragao/lms-ui/package.json", "utf8"));
  const host = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(contracts.version, "0.1.0");
  assert.equal(core.version, "0.1.0");
  assert.equal(ui.version, "0.1.0");
  assert.equal(contracts.dependencies, undefined);
  assert.deepEqual(core.dependencies, { "@kupragao/lms-contracts": "0.1.0" });
  assert.deepEqual(ui.dependencies, { "@kupragao/lms-core": "0.1.0" });
  assert.equal(ui.peerDependencies.react, "19.3.1");
  for (const name of ["@kupragao/lms-contracts", "@kupragao/lms-core", "@kupragao/lms-ui"]) {
    assert.equal(host.dependencies[name], "0.1.0");
  }
  for (const manifest of [contracts, core, ui]) {
    const names = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies });
    for (const name of names) {
      assert.equal(/supabase|prisma|better-life/i.test(name), false, name);
    }
  }
});

test("host adapter compatibility", () => {
  const manage = readFileSync("src/modules/catalog/manage.ts", "utf8");
  const courseDb = readFileSync("src/modules/host/course-db.ts", "utf8");
  assert.match(manage, /export function createCourse\(actorId: string, form: FormData\)/);
  assert.match(manage, /export function saveCourseBasics\(actorId: string, courseId: string, locale: LearningLocale, form: FormData\)/);
  assert.match(manage, /export function saveCoursePlan\(actorId: string, courseId: string, locale: LearningLocale, form: FormData\)/);
  assert.match(manage, /export function saveCourseAccess\(actorId: string, courseId: string, form: FormData\)/);
  assert.equal(manage.includes("app.\"AppUser\""), false);
  assert.match(courseDb, /FOR SHARE/);
  assert.match(courseDb, /FOR UPDATE/);
  assert.match(courseDb, /appUser\.findUnique/);
  assert.equal(authorScope, hostScope);
  assert.equal(parseVideo, hostVideo);
  assert.equal(progressPercent, hostProgress);
  assert.equal(RichText, hostRichText);
  assert.equal(LessonVideo, hostVideoView);
  assert.equal(detectAsset, hostDetect);
  assert.equal(basicsChanged, hostBasicsChanged);
});

test("package import resolution", () => {
  const forbidden = ["@/", "generated/prisma", "@prisma/client", "supabase", "SUPABASE_", "next/navigation", "@/lib/db"];
  const files = [
    ...packageSources("node_modules/@kupragao/lms-contracts/dist"),
    ...packageSources("node_modules/@kupragao/lms-core/dist"),
    ...packageSources("node_modules/@kupragao/lms-ui/dist"),
  ];
  assert.equal(files.length > 0, true);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const marker of forbidden) {
      assert.equal(source.includes(marker), false, `${file} contains ${marker}`);
    }
  }
});
