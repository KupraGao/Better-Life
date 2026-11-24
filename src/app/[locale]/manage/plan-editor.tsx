"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Locale, Messages } from "@/i18n";
import { savePlanAction } from "./actions";
import { newLesson, newModule, planChanged, planForm, type PlanAsset, type PlanDraft, type PlanLesson, type PlanModule } from "./draft";
import { editorMessage } from "./editor-message";
import { LeaveDialog, SaveBar, useLeaveGuard, useServerSnapshot } from "./leave-guard";
import styles from "./manage.module.css";

function assetLabel(mimeType: string) {
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPEG";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("text/plain")) return "TXT";
  return mimeType;
}

function sizeLabel(bytes: number, locale: Locale) {
  if (bytes < 1024) return locale === "ka" ? `${bytes} ბაიტი` : `${bytes} B`;
  const amount = Math.round((bytes / 1024) * 10) / 10;
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  return `${text} ${locale === "ka" ? "კიბ" : "KiB"}`;
}

function fileName(template: string, name: string) {
  return template.split("{name}").join(name);
}

export function PlanEditor({ locale, edit, courseId, initial, revision, stamp, t }: {
  locale: Locale;
  edit: Locale;
  courseId: string;
  initial: PlanDraft;
  revision: string;
  stamp: string;
  t: Messages["manage"];
}) {
  const router = useRouter();
  const sync = useServerSnapshot(revision, initial, planChanged);
  const [token, setToken] = useState(stamp);
  if (sync.didAdopt && token !== stamp) setToken(stamp);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const [files, setFiles] = useState<Map<string, File>>(() => new Map());
  if (sync.didAdopt) {
    if (files.size) setFiles(new Map());
    if (busy) setBusy(false);
  }
  const draft = sync.draft;
  const dirty = sync.dirty;
  const holding = busy || sync.holding;

  function editDraft(next: PlanDraft) {
    setSaved(false);
    setError(null);
    sync.setDraft(next);
  }

  function dropFiles(assets: PlanAsset[]) {
    setFiles((current) => {
      const next = new Map(current);
      for (const asset of assets) next.delete(asset.key);
      return next;
    });
  }

  function patchModule(key: string, update: (courseModule: PlanModule) => PlanModule) {
    editDraft({ modules: draft.modules.map((courseModule) => courseModule.key === key ? update(courseModule) : courseModule) });
  }

  function patchLesson(moduleKey: string, lessonKey: string, update: (lesson: PlanLesson) => PlanLesson) {
    patchModule(moduleKey, (courseModule) => ({
      ...courseModule,
      lessons: courseModule.lessons.map((lesson) => lesson.key === lessonKey ? update(lesson) : lesson),
    }));
  }

  function move(list: { key: string }[], index: number, direction: -1 | 1) {
    const next = list.slice();
    const target = next[index + direction];
    if (!target) return list;
    [next[index], next[index + direction]] = [target, next[index]];
    return next;
  }

  function removeModule(courseModule: PlanModule) {
    if (!courseModule.id) {
      dropFiles(courseModule.lessons.flatMap((lesson) => lesson.assets));
      editDraft({ modules: draft.modules.filter((item) => item.key !== courseModule.key) });
      return;
    }
    patchModule(courseModule.key, (current) => ({ ...current, remove: true }));
  }

  function removeLesson(moduleKey: string, lesson: PlanLesson) {
    if (!lesson.id) {
      dropFiles(lesson.assets);
      patchModule(moduleKey, (current) => ({ ...current, lessons: current.lessons.filter((item) => item.key !== lesson.key) }));
      return;
    }
    patchLesson(moduleKey, lesson.key, (current) => ({ ...current, remove: true }));
  }

  async function save() {
    if (saving.current || holding) return false;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await savePlanAction(locale, courseId, edit, planForm(draft, files, token));
      if (!result.ok) {
        setError(editorMessage(result.code, t));
        return false;
      }
      if (result.stamp) setToken(result.stamp);
      sync.adopt(result.plan ?? draft);
      setFiles(new Map());
      setSaved(true);
      router.refresh();
      return true;
    } catch {
      setError(t.invalid);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const guard = useLeaveGuard(dirty, holding, save, () => {
    dropFiles(draft.modules.flatMap((courseModule) => courseModule.lessons.flatMap((lesson) => lesson.assets)));
    sync.keepBaseline();
    setError(null);
    setSaved(false);
  });

  function href(lang: Locale) {
    return `/${locale}/manage/${courseId}?edit=${lang}&tab=plan`;
  }

  return <section className={styles.panel}>
    <h2>{t.modules}</h2>
    <nav className={styles.languages} aria-label={t.translation}>
      <span>{t.translation}</span>
      {(["ka", "en"] as const).map((lang) => <Link key={lang} href={href(lang)} aria-current={edit === lang ? "true" : undefined}>{t[lang]}</Link>)}
    </nav>
    {!draft.modules.length && <p>{t.emptyModules}</p>}
    {draft.modules.map((courseModule, moduleIndex) => {
      const heading = courseModule.title.trim() || courseModule.fallbackTitle || t.moduleName;
      return <article key={courseModule.key} className={courseModule.remove ? `${styles.module} ${styles.pending}` : styles.module}>
        <h3>{moduleIndex + 1}. {heading}{!courseModule.title.trim() && courseModule.fallbackTitle ? <small> {t.missingLanguage}</small> : null}</h3>
        {courseModule.remove ? <div className={styles.pendingBox}>
          <p className={styles.pendingText} role="status">{t.pendingRemoval}</p>
          <button type="button" onClick={() => patchModule(courseModule.key, (current) => ({ ...current, remove: false }))}>{t.undoRemoval}</button>
        </div> : <>
          <div className={styles.moduleBar}>
            <div className={styles.moves}>
              {moduleIndex > 0 && <button type="button" onClick={() => editDraft({ modules: move(draft.modules, moduleIndex, -1) as PlanModule[] })}>↑ {t.up}</button>}
              {moduleIndex < draft.modules.length - 1 && <button type="button" onClick={() => editDraft({ modules: move(draft.modules, moduleIndex, 1) as PlanModule[] })}>↓ {t.down}</button>}
            </div>
            <button type="button" className={styles.danger} onClick={() => removeModule(courseModule)}>{t.remove}</button>
          </div>
          <label>{t.moduleName}<input lang={edit} maxLength={180} value={courseModule.title} onChange={(event) => patchModule(courseModule.key, (current) => ({ ...current, title: event.target.value }))} /></label>
          {courseModule.lessons.map((lesson, lessonIndex) => <div className={lesson.remove ? `${styles.lesson} ${styles.pending}` : styles.lesson} key={lesson.key}>
            {lesson.remove ? <>
              <p>{moduleIndex + 1}.{lessonIndex + 1} {lesson.title || t.newLesson}</p>
              <p className={styles.pendingText} role="status">{t.pendingRemoval}</p>
              <button type="button" onClick={() => patchLesson(courseModule.key, lesson.key, (current) => ({ ...current, remove: false }))}>{t.undoRemoval}</button>
            </> : <>
              <details>
                <summary>{moduleIndex + 1}.{lessonIndex + 1} {lesson.title || t.newLesson}<small>{lesson.published ? t.lessonShown : t.lessonHidden}</small></summary>
                <label>{t.name}<input lang={edit} required maxLength={180} value={lesson.title} onChange={(event) => patchLesson(courseModule.key, lesson.key, (current) => ({ ...current, title: event.target.value }))} /></label>
                <label>{t.body}<textarea lang={edit} required rows={6} maxLength={32000} value={lesson.body} onChange={(event) => patchLesson(courseModule.key, lesson.key, (current) => ({ ...current, body: event.target.value }))} /></label>
                <small>{t.format}</small>
                <label>{t.video}<input dir="ltr" type="url" value={lesson.video} onChange={(event) => patchLesson(courseModule.key, lesson.key, (current) => ({ ...current, video: event.target.value }))} /></label>
                <h4>{t.files}</h4>
                {lesson.assets.some((asset) => asset.action !== "delete") && <ul className={styles.assetList}>
                  {lesson.assets.filter((asset) => asset.action !== "delete").map((asset) => <li className={styles.assetItem} key={asset.key}>
                    <p className={styles.assetName}>{asset.name}</p>
                    <p className={styles.assetMeta}>
                      {asset.mimeType ? <span>{t.fileType}: {assetLabel(asset.mimeType)}</span> : null}
                      <span>{t.fileSize}: {sizeLabel(asset.sizeBytes, locale)}</span>
                      {asset.id && asset.action === "keep" ? <a className={styles.asset} href={`/api/media/${asset.id}?locale=${edit}`}>{asset.kind === "IMAGE" ? t.viewFile : t.downloadFile}</a> : null}
                      {asset.action !== "keep" ? <span>{t.unsaved}</span> : null}
                    </p>
                    {asset.action !== "create" && <label>{t.replaceFile}<input type="file" accept=".png,.jpg,.jpeg,.pdf,.txt" aria-label={`${t.replaceFile}: ${asset.name}`} onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file || asset.action === "create") return;
                      setFiles((current) => new Map(current).set(asset.key, file));
                      patchLesson(courseModule.key, lesson.key, (current) => ({
                        ...current,
                        assets: current.assets.map((item) => item.key === asset.key ? { ...item, name: file.name, sizeBytes: file.size, mimeType: "", action: "replace" } : item),
                      }));
                    }} /></label>}
                    <button type="button" className={styles.danger} onClick={() => {
                      if (!window.confirm(fileName(t.deleteConfirm, asset.name))) return;
                      if (asset.action === "create") setFiles((current) => {
                        const next = new Map(current);
                        next.delete(asset.key);
                        return next;
                      });
                      patchLesson(courseModule.key, lesson.key, (current) => ({
                        ...current,
                        assets: asset.action === "create" ? current.assets.filter((item) => item.key !== asset.key) : current.assets.map((item) => item.key === asset.key ? { ...item, action: "delete" } : item),
                      }));
                    }}>{t.remove}</button>
                  </li>)}
                </ul>}
                <label>{t.file}<input type="file" accept=".png,.jpg,.jpeg,.pdf,.txt" multiple onChange={(event) => {
                  const selected = [...(event.target.files ?? [])];
                  event.target.value = "";
                  if (!selected.length) return;
                  const assets: PlanAsset[] = selected.map((file) => {
                    const key = `new-${crypto.randomUUID()}`;
                    setFiles((current) => new Map(current).set(key, file));
                    return { key, id: null, name: file.name, mimeType: "", sizeBytes: file.size, kind: "", action: "create" };
                  });
                  patchLesson(courseModule.key, lesson.key, (current) => ({ ...current, assets: [...current.assets, ...assets] }));
                }} /></label>
              </details>
              <div className={styles.lessonBar}>
                <label className={styles.check}>
                  <input type="checkbox" checked={lesson.published} onChange={(event) => patchLesson(courseModule.key, lesson.key, (current) => ({ ...current, published: event.target.checked }))} />
                  {lesson.published ? t.lessonShown : t.lessonHidden}
                </label>
                <div className={styles.moves}>
                  {lessonIndex > 0 && <button type="button" onClick={() => patchModule(courseModule.key, (current) => ({ ...current, lessons: move(current.lessons, lessonIndex, -1) as PlanLesson[] }))}>↑ {t.up}</button>}
                  {lessonIndex < courseModule.lessons.length - 1 && <button type="button" onClick={() => patchModule(courseModule.key, (current) => ({ ...current, lessons: move(current.lessons, lessonIndex, 1) as PlanLesson[] }))}>↓ {t.down}</button>}
                </div>
                <button type="button" className={styles.danger} onClick={() => removeLesson(courseModule.key, lesson)}>{t.remove}</button>
              </div>
            </>}
          </div>)}
          <button type="button" onClick={() => patchModule(courseModule.key, (current) => ({
            ...current,
            lessons: [...current.lessons, newLesson(`new-${crypto.randomUUID()}`)],
          }))}>{t.newLesson}</button>
        </>}
      </article>;
    })}
    <button type="button" onClick={() => editDraft({ modules: [...draft.modules, newModule(`new-${crypto.randomUUID()}`)] })}>{t.newModule}</button>
    <form data-editor-save="true" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <SaveBar dirty={dirty} busy={holding} saved={saved} error={error} t={t} onSave={() => void save()} />
    </form>
    <LeaveDialog open={guard.target !== null} preview={guard.target?.kind === "url" && guard.target.preview} t={t} onSave={() => void guard.saveAndLeave()} onDiscard={guard.discardAndLeave} onStay={guard.stay} />
  </section>;
}
