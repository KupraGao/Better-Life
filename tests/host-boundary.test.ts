// Repeat with: npx tsx --test tests/host-boundary.test.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { authorScope, EditorError } from "@kupragao/lms-core";
import { isLearningLocale } from "@kupragao/lms-contracts";

function packageSources(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) return packageSources(path);
    if (name.endsWith(".map")) return [];
    return name.endsWith(".js") || name.endsWith(".d.ts") ? [path] : [];
  });
}

const domainFiles = [
  ...packageSources("node_modules/@kupragao/lms-contracts/dist"),
  ...packageSources("node_modules/@kupragao/lms-core/dist"),
  ...packageSources("node_modules/@kupragao/lms-ui/dist"),
  "src/modules/learning/labels.ts",
];

const forbidden = [
  "@/generated/prisma/client",
  "@/lib/db",
  "@/modules/identity",
  "@/i18n",
  "messages/learning",
  "messages/ka.json",
  "messages/en.json",
  "requireUser",
  "getCurrentUser",
  "revalidatePath",
  "next/navigation",
];

test("learning domain files do not import the host runtime", () => {
  for (const file of domainFiles) {
    const source = readFileSync(file, "utf8");
    for (const marker of forbidden) {
      assert.equal(source.includes(marker), false, `${file} contains ${marker}`);
    }
  }
});

test("the host adapter creates the learning actor", () => {
  const actions = readFileSync("src/modules/learning/actions.ts", "utf8");
  const route = readFileSync("src/app/api/media/[assetId]/route.ts", "utf8");
  assert.equal(actions.includes("requireUser"), true);
  assert.equal(actions.includes("form.get"), false);
  assert.equal(route.includes("getCurrentUser"), true);
  assert.equal(route.includes("readAsset"), true);
});

test("author scope rejects a student and keeps instructor assignment", () => {
  assert.throws(() => authorScope({ id: "student", role: "STUDENT" }), (error: unknown) => error instanceof EditorError && error.code === "denied");
  assert.deepEqual(authorScope({ id: "admin", role: "ADMIN" }), { archivedAt: null });
  assert.deepEqual(authorScope({ id: "teacher", role: "INSTRUCTOR" }), {
    archivedAt: null,
    instructors: { some: { userId: "teacher" } },
  });
});

test("learning locales stay ka and en", () => {
  assert.equal(isLearningLocale("ka"), true);
  assert.equal(isLearningLocale("en"), true);
  assert.equal(isLearningLocale("fr"), false);
});
