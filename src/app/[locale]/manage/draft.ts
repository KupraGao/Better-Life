export type BasicsDraft = {
  title: string;
  body: string;
  slug: string;
  cover: string;
  level: string;
  categoryIds: string[];
};

export type AccessDraft = {
  mode: "free" | "paid" | "closed";
  priceRegular: string;
  priceSale: string;
  listed: boolean;
};

function sameIds(left: string[], right: string[]) {
  return left.slice().sort().join("\0") === right.slice().sort().join("\0");
}

export function basicsChanged(current: BasicsDraft, baseline: BasicsDraft) {
  return current.title !== baseline.title
    || current.body !== baseline.body
    || current.slug !== baseline.slug
    || current.cover !== baseline.cover
    || current.level !== baseline.level
    || !sameIds(current.categoryIds, baseline.categoryIds);
}

export type PlanAsset = {
  key: string;
  id: string | null;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: "IMAGE" | "ATTACHMENT" | "";
  action: "keep" | "delete" | "replace" | "create";
};

export type PlanLesson = {
  key: string;
  id: string | null;
  title: string;
  body: string;
  video: string;
  published: boolean;
  remove: boolean;
  assets: PlanAsset[];
};

export type PlanModule = {
  key: string;
  id: string | null;
  title: string;
  fallbackTitle: string;
  remove: boolean;
  lessons: PlanLesson[];
};

export function newLesson(key: string): PlanLesson {
  return { key, id: null, title: "", body: "", video: "", published: false, remove: false, assets: [] };
}

export function newModule(key: string): PlanModule {
  return { key, id: null, title: "", fallbackTitle: "", remove: false, lessons: [] };
}

export type PlanDraft = { modules: PlanModule[] };

export function planChanged(current: PlanDraft, baseline: PlanDraft) {
  return JSON.stringify(current) !== JSON.stringify(baseline);
}

function lessonPayload(lesson: PlanLesson) {
  const payload: {
    key: string;
    id: string | null;
    title: string;
    body: string;
    video: string;
    published: boolean;
    remove?: true;
    assets: { key: string; id: string | null; action: PlanAsset["action"] }[];
  } = {
    key: lesson.key,
    id: lesson.id,
    title: lesson.title,
    body: lesson.body,
    video: lesson.video,
    published: lesson.published,
    assets: lesson.assets.map((asset) => ({ key: asset.key, id: asset.id, action: asset.action })),
  };
  if (lesson.id && lesson.remove) payload.remove = true;
  return payload;
}

export function planForm(draft: PlanDraft, files: Map<string, File>, stamp: string) {
  const form = new FormData();
  form.set("stamp", stamp);
  const modules = draft.modules.flatMap((courseModule) => {
    if (!courseModule.id && courseModule.remove) return [];
    const payload: {
      key: string;
      id: string | null;
      title: string;
      remove?: true;
      lessons: ReturnType<typeof lessonPayload>[];
    } = {
      key: courseModule.key,
      id: courseModule.id,
      title: courseModule.title,
      lessons: courseModule.lessons.flatMap((lesson) => (!lesson.id && (lesson.remove || courseModule.remove)) ? [] : [lessonPayload(lesson)]),
    };
    if (courseModule.id && courseModule.remove) payload.remove = true;
    return [payload];
  });
  form.set("plan", JSON.stringify({ modules }));
  for (const courseModule of draft.modules) {
    if (courseModule.remove) continue;
    for (const lesson of courseModule.lessons) {
      if (lesson.remove) continue;
      for (const asset of lesson.assets) {
        if (asset.action !== "create" && asset.action !== "replace") continue;
        const file = files.get(asset.key);
        if (file) form.set(`file:${asset.key}`, file);
      }
    }
  }
  return form;
}

export function accessChanged(current: AccessDraft, baseline: AccessDraft) {
  return current.mode !== baseline.mode
    || current.priceRegular !== baseline.priceRegular
    || current.priceSale !== baseline.priceSale
    || current.listed !== baseline.listed;
}

export function basicsForm(draft: BasicsDraft, stamp: string) {
  const form = new FormData();
  form.set("stamp", stamp);
  form.set("title", draft.title);
  form.set("body", draft.body);
  form.set("slug", draft.slug);
  form.set("cover", draft.cover);
  form.set("level", draft.level);
  for (const id of draft.categoryIds) form.append("category", id);
  return form;
}

export function accessForm(draft: AccessDraft, stamp: string) {
  const form = new FormData();
  form.set("stamp", stamp);
  form.set("mode", draft.mode);
  form.set("priceRegular", draft.priceRegular);
  form.set("priceSale", draft.priceSale);
  if (draft.listed) form.set("listed", "on");
  return form;
}
