"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Locale, Messages } from "@/i18n";
import { saveBasicsAction } from "./actions";
import { basicsChanged, basicsForm, type BasicsDraft } from "./draft";
import { editorMessage } from "./editor-message";
import { LeaveDialog, SaveBar, useLeaveGuard, useServerSnapshot } from "./leave-guard";
import styles from "./manage.module.css";

export function BasicsEditor({ locale, edit, courseId, page, notice, initial, categories, showMissing, revision, stamp, t }: {
  locale: Locale;
  edit: Locale;
  courseId: string;
  page: number;
  notice?: string;
  initial: BasicsDraft;
  categories: { id: string; label: string }[];
  showMissing: boolean;
  revision: string;
  stamp: string;
  t: Messages["manage"];
}) {
  const router = useRouter();
  const sync = useServerSnapshot(revision, initial, basicsChanged);
  const [token, setToken] = useState(stamp);
  if (sync.didAdopt && token !== stamp) setToken(stamp);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  if (sync.didAdopt && busy) setBusy(false);
  const draft = sync.draft;
  const dirty = sync.dirty;
  const holding = busy || sync.holding;

  function update(patch: Partial<BasicsDraft>) {
    setSaved(false);
    setError(null);
    sync.setDraft((current) => ({ ...current, ...patch }));
  }

  async function save() {
    if (saving.current || holding) return false;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await saveBasicsAction(locale, courseId, edit, basicsForm(draft, token));
      if (!result.ok) {
        setError(editorMessage(result.code, t));
        return false;
      }
      if (result.stamp) setToken(result.stamp);
      sync.adopt(draft);
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
    sync.keepBaseline();
    setError(null);
    setSaved(false);
  });

  function href(lang: Locale) {
    const query = new URLSearchParams();
    query.set("edit", lang);
    query.set("tab", "basics");
    if (notice) query.set("notice", notice);
    if (page > 1) query.set("page", String(page));
    return `/${locale}/manage/${courseId}?${query}`;
  }

  return <section className={styles.panel}>
    <h2>{t.basics}</h2>
    <nav className={styles.languages} aria-label={t.translation}>
      <span>{t.translation}</span>
      {(["ka", "en"] as const).map((lang) => <Link key={lang} href={href(lang)} aria-current={edit === lang ? "true" : undefined}>{t[lang]}</Link>)}
    </nav>
    {showMissing && <p className={styles.notice} role="status">{t.missingLanguage}</p>}
    <form data-editor-save="true" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label>{t.name}<input lang={edit} name="title" required maxLength={180} value={draft.title} onChange={(event) => update({ title: event.target.value })} /></label>
      <label>{t.description}<textarea lang={edit} name="body" rows={4} maxLength={16000} value={draft.body} onChange={(event) => update({ body: event.target.value })} /></label>
      <small>{t.format}</small>
      <label>{t.slug}<input name="slug" required dir="ltr" maxLength={100} value={draft.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={(event) => update({ slug: event.target.value })} /></label>
      <small>{t.slugHelp}</small>
      <label>{t.cover}<input name="cover" dir="ltr" type="url" maxLength={2000} value={draft.cover} placeholder="https://" onChange={(event) => update({ cover: event.target.value })} /></label>
      <small>{t.coverHelp}</small>
      {draft.cover.startsWith("https://") && (
        // The address is entered by the course editor and is not on an image allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.coverPreview} src={draft.cover} alt="" />
      )}
      <label>{t.level}<select name="level" value={draft.level} onChange={(event) => update({ level: event.target.value })}>
        <option value="">{t.levelUnset}</option>
        <option value="BEGINNER">{t.beginner}</option>
        <option value="INTERMEDIATE">{t.intermediate}</option>
        <option value="ADVANCED">{t.advanced}</option>
      </select></label>
      <fieldset>
        <legend>{t.categories}</legend>
        {categories.length ? categories.map((item) => <label className={styles.check} key={item.id}>
          <input type="checkbox" name="category" value={item.id} checked={draft.categoryIds.includes(item.id)} onChange={(event) => {
            const categoryIds = event.target.checked
              ? [...draft.categoryIds, item.id]
              : draft.categoryIds.filter((id) => id !== item.id);
            update({ categoryIds });
          }} />{item.label}
        </label>) : <small>{t.noCategories}</small>}
      </fieldset>
      <SaveBar dirty={dirty} busy={holding} saved={saved} error={error} t={t} onSave={() => void save()} />
    </form>
    <LeaveDialog open={guard.target !== null} preview={guard.target?.kind === "url" && guard.target.preview} t={t} onSave={() => void guard.saveAndLeave()} onDiscard={guard.discardAndLeave} onStay={guard.stay} />
  </section>;
}
