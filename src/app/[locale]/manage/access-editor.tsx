"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Locale, Messages } from "@/i18n";
import { saveAccessAction } from "./actions";
import { accessChanged, accessForm, type AccessDraft } from "./draft";
import { editorMessage } from "./editor-message";
import { LeaveDialog, SaveBar, useLeaveGuard, useServerSnapshot } from "./leave-guard";
import styles from "./manage.module.css";

export function AccessEditor({ locale, courseId, initial, revision, stamp, t }: {
  locale: Locale;
  courseId: string;
  initial: AccessDraft;
  revision: string;
  stamp: string;
  t: Messages["manage"];
}) {
  const router = useRouter();
  const sync = useServerSnapshot(revision, initial, accessChanged);
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

  function update(patch: Partial<AccessDraft>) {
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
      const result = await saveAccessAction(locale, courseId, accessForm(draft, token));
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

  return <>
    <form data-editor-save="true" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className={styles.choice}>
        <label className={styles.check}><input name="mode" type="radio" value="free" checked={draft.mode === "free"} onChange={() => update({ mode: "free" })} />{t.modeFree}</label>
        <label className={styles.check}><input name="mode" type="radio" value="paid" checked={draft.mode === "paid"} onChange={() => update({ mode: "paid" })} />{t.modePaid}</label>
        <label className={styles.check}><input name="mode" type="radio" value="closed" checked={draft.mode === "closed"} onChange={() => update({ mode: "closed" })} />{t.modeClosed}</label>
      </div>
      <label>{t.priceRegular}<input name="priceRegular" inputMode="decimal" dir="ltr" value={draft.priceRegular} placeholder="240" onChange={(event) => update({ priceRegular: event.target.value })} /></label>
      <label>{t.priceSale}<input name="priceSale" inputMode="decimal" dir="ltr" value={draft.priceSale} placeholder="160" onChange={(event) => update({ priceSale: event.target.value })} /></label>
      <small>{t.priceHelp}</small>
      <small>{t.paidNote}</small>
      <label className={styles.check}><input name="listed" type="checkbox" checked={draft.listed} onChange={(event) => update({ listed: event.target.checked })} />{t.listed}</label>
      <SaveBar dirty={dirty} busy={holding} saved={saved} error={error} t={t} onSave={() => void save()} />
    </form>
    <LeaveDialog open={guard.target !== null} preview={guard.target?.kind === "url" && guard.target.preview} t={t} onSave={() => void guard.saveAndLeave()} onDiscard={guard.discardAndLeave} onStay={guard.stay} />
  </>;
}
