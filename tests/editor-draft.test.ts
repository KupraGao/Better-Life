import assert from "node:assert/strict";
import test from "node:test";
import { accessChanged, basicsChanged, newLesson, newModule, planChanged, planForm, type AccessDraft, type BasicsDraft, type PlanDraft, type PlanLesson } from "../src/app/[locale]/manage/draft.ts";

const basics: BasicsDraft = {
  title: "საფუძვლები", body: "აღწერა", slug: "basics", cover: "", level: "", categoryIds: ["b", "a"],
};
const access: AccessDraft = { mode: "paid", priceRegular: "240", priceSale: "160", listed: true };

test("a tab is dirty only when its own fields change", () => {
  assert.equal(basicsChanged(basics, { ...basics, categoryIds: ["a", "b"] }), false);
  assert.equal(basicsChanged({ ...basics, title: "ახალი" }, basics), true);
  assert.equal(basicsChanged({ ...basics, categoryIds: ["a"] }, basics), true);
  assert.equal(accessChanged(access, { ...access }), false);
  assert.equal(accessChanged({ ...access, priceSale: "150" }, access), true);
  assert.equal(accessChanged(access, { ...access, listed: false }), true);
  const plan: PlanDraft = { modules: [{
    key: "module", id: "module", title: "მოდული", fallbackTitle: "", remove: false,
    lessons: [{ key: "lesson", id: "lesson", title: "გაკვეთილი", body: "ტექსტი", video: "", published: false, remove: false, assets: [] }],
  }] };
  assert.equal(planChanged(plan, { modules: plan.modules.map((courseModule) => ({ ...courseModule })) }), false);
  assert.equal(planChanged({ modules: [{ ...plan.modules[0], title: "ახალი" }] }, plan), true);
  const reordered = { modules: [{
    ...plan.modules[0],
    lessons: [{ ...newLesson("second"), title: "მეორე", body: "ტექსტი" }, ...plan.modules[0].lessons],
  }] };
  assert.equal(planChanged(reordered, plan), true);
  assert.equal(planChanged({ modules: [{ ...plan.modules[0], lessons: [{ ...plan.modules[0].lessons[0], published: true }] }] }, plan), true);
  assert.equal(planChanged({ modules: [{ ...plan.modules[0], remove: true }] }, plan), true);
});

function readPlan(draft: PlanDraft, files = new Map<string, File>()) {
  return JSON.parse(String(planForm(draft, files, "stamp").get("plan"))) as {
    modules: Array<{
      key: string;
      id: string | null;
      title: string;
      remove?: true;
      lessons: Array<PlanLesson & { remove?: true; assets: { key: string; id: string | null; action: string }[] }>;
    }>;
  };
}

test("new lessons stay hidden and unsaved rows are omitted", () => {
  const lesson = newLesson("new-lesson");
  assert.equal(lesson.id, null);
  assert.equal(lesson.published, false);
  assert.equal(lesson.remove, false);
  const titled = { ...lesson, title: "ქართული სათაური", body: "ტექსტი" };
  assert.equal(titled.published, false);
  const dropped = { ...newLesson("drop-lesson"), title: "წასაშლელი", remove: true };
  const plan = readPlan({ modules: [{ ...newModule("new-module"), title: "ახალი", lessons: [titled, dropped] }, { ...newModule("drop-module"), remove: true }] });
  assert.equal(plan.modules.length, 1);
  assert.equal(plan.modules[0].id, null);
  assert.equal("remove" in plan.modules[0], false);
  assert.equal(plan.modules[0].lessons.length, 1);
  assert.equal(plan.modules[0].lessons[0].published, false);
  assert.equal(plan.modules[0].lessons[0].title, "ქართული სათაური");
  assert.equal("remove" in plan.modules[0].lessons[0], false);
});

test("planForm keeps saved removals and the published flag", () => {
  const hidden: PlanLesson = {
    key: "hidden", id: "lesson-hidden", title: "დამალული გაკვეთილი", body: "ტექსტი", video: "", published: false, remove: false, assets: [],
  };
  const removed: PlanLesson = {
    key: "removed", id: "lesson-removed", title: "არქივი", body: "ტექსტი", video: "", published: true, remove: true,
    assets: [{ key: "gone-file", id: null, name: "gone.txt", mimeType: "", sizeBytes: 4, kind: "", action: "create" }],
  };
  const visible = { ...newLesson("visible"), id: "lesson-visible", title: "ჩანს", body: "ტექსტი", published: true };
  const file = new File(["abc"], "note.txt", { type: "text/plain" });
  const kept = {
    ...newLesson("kept"),
    title: "ფაილით",
    body: "ტექსტი",
    assets: [{ key: "kept-file", id: null, name: file.name, mimeType: "", sizeBytes: file.size, kind: "" as const, action: "create" as const }],
  };
  const form = planForm({
    modules: [
      { ...newModule("saved-module"), id: "module-saved", title: "მოდული", lessons: [hidden, removed, visible, kept] },
      {
        ...newModule("archive-module"),
        id: "module-archive",
        title: "ძველი",
        remove: true,
        lessons: [
          { ...newLesson("inside"), id: "lesson-inside", title: "შიგნით", body: "ტექსტი", published: false },
          { ...newLesson("draft-inside"), title: "ახალი", body: "ტექსტი" },
        ],
      },
    ],
  }, new Map([["kept-file", file], ["gone-file", new File(["gone"], "gone.txt")]]), "stamp");
  assert.equal(form.get("stamp"), "stamp");
  const plan = JSON.parse(String(form.get("plan"))) as ReturnType<typeof readPlan>;
  assert.equal(plan.modules.length, 2);
  assert.equal(plan.modules[0].remove, undefined);
  assert.equal(plan.modules[1].remove, true);
  assert.deepEqual(plan.modules[1].lessons.map((lesson) => lesson.id), ["lesson-inside"]);
  const lessons = plan.modules[0].lessons;
  assert.deepEqual(lessons.map((lesson) => lesson.key), ["hidden", "removed", "visible", "kept"]);
  assert.deepEqual(lessons.map((lesson) => lesson.id), ["lesson-hidden", "lesson-removed", "lesson-visible", null]);
  assert.equal(lessons[0].published, false);
  assert.equal(lessons[0].title, "დამალული გაკვეთილი");
  assert.equal("remove" in lessons[0], false);
  assert.equal(lessons[1].remove, true);
  assert.equal(lessons[1].published, true);
  assert.equal(lessons[2].published, true);
  assert.equal("remove" in lessons[2], false);
  assert.equal(lessons[3].published, false);
  assert.equal(form.get("file:kept-file"), file);
  assert.equal(form.get("file:gone-file"), null);
});
