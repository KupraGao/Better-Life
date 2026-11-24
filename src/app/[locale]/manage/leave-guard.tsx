"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Messages } from "@/i18n";
import styles from "./manage.module.css";

type LeaveTarget = { kind: "url"; href: string; preview: boolean } | { kind: "submit"; form: HTMLFormElement } | { kind: "back"; key: string };

type BrowserNavigateEvent = Event & {
  cancelable: boolean;
  navigationType?: string;
  destination?: { key?: string; url?: string };
  preventDefault: () => void;
};

type BrowserNavigation = {
  addEventListener: (type: "navigate", listener: (event: BrowserNavigateEvent) => void) => void;
  removeEventListener: (type: "navigate", listener: (event: BrowserNavigateEvent) => void) => void;
  traverseTo: (key: string) => void;
};

export function useServerSnapshot<T>(revision: string, initial: T, changed: (current: T, baseline: T) => boolean) {
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [seen, setSeen] = useState(revision);
  const [armedFrom, setArmedFrom] = useState<string | null>(null);
  const dirtyNow = changed(draft, baseline);
  const didAdopt = (armedFrom !== null && revision !== armedFrom)
    || (armedFrom === null && !dirtyNow && revision !== seen);
  if (didAdopt) {
    setArmedFrom(null);
    setSeen(revision);
    setDraft(initial);
    setBaseline(initial);
  }
  const current = didAdopt ? initial : draft;
  const currentBaseline = didAdopt ? initial : baseline;

  function arm(from: string) {
    setArmedFrom(from);
  }

  function adopt(next: T) {
    setDraft(next);
    setBaseline(next);
    setArmedFrom(null);
    setSeen(revision);
  }

  function keepBaseline() {
    setDraft(baseline);
    setSeen(revision);
    setArmedFrom(null);
  }

  return {
    draft: current,
    baseline: currentBaseline,
    setDraft: setDraft as Dispatch<SetStateAction<T>>,
    dirty: changed(current, currentBaseline),
    holding: armedFrom !== null && !didAdopt,
    didAdopt,
    arm,
    adopt,
    keepBaseline,
  };
}

export function useLeaveGuard(dirty: boolean, busy: boolean, save: () => Promise<boolean>, reset: () => void) {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  const busyRef = useRef(busy);
  const saveRef = useRef(save);
  const resetRef = useRef(reset);
  const bypass = useRef(false);
  const [target, setTarget] = useState<LeaveTarget | null>(null);
  useEffect(() => {
    dirtyRef.current = dirty;
    busyRef.current = busy;
    saveRef.current = save;
    resetRef.current = reset;
  });

  const blocked = dirty || busy;

  useEffect(() => {
    if (!blocked) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypass.current || (!dirtyRef.current && !busyRef.current)) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocked]);

  useEffect(() => {
    if (!blocked) return;
    const onClick = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (`${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) return;
      if (busyRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget({ kind: "url", href: `${url.pathname}${url.search}${url.hash}`, preview: anchor.dataset.preview === "saved" });
    };
    const onSubmit = (event: Event) => {
      if (bypass.current) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.editorSave === "true") return;
      if (busyRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget({ kind: "submit", form });
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [blocked]);

  useEffect(() => {
    if (!blocked) return;
    const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
    if (!navigation) return;
    const onNavigate = (event: BrowserNavigateEvent) => {
      if (bypass.current || event.navigationType !== "traverse" || !event.cancelable) return;
      const key = event.destination?.key;
      if (!key) return;
      if (busyRef.current) {
        event.preventDefault();
        return;
      }
      if (!dirtyRef.current) return;
      event.preventDefault();
      setTarget({ kind: "back", key });
    };
    navigation.addEventListener("navigate", onNavigate);
    return () => navigation.removeEventListener("navigate", onNavigate);
  }, [blocked]);

  function go(next: LeaveTarget) {
    bypass.current = true;
    setTarget(null);
    if (next.kind === "url") router.push(next.href);
    else if (next.kind === "submit") next.form.requestSubmit();
    else {
      const navigation = (window as Window & { navigation?: BrowserNavigation }).navigation;
      navigation?.traverseTo(next.key);
    }
    window.setTimeout(() => { bypass.current = false; }, 0);
  }

  async function saveAndLeave() {
    if (!target) return;
    const next = target;
    const ok = await saveRef.current();
    if (!ok) {
      setTarget(null);
      return;
    }
    go(next);
  }

  function discardAndLeave() {
    if (!target) return;
    const next = target;
    resetRef.current();
    go(next);
  }

  return { target, saveAndLeave, discardAndLeave, stay: () => setTarget(null) };
}

export function LeaveDialog({ open, preview = false, t, onSave, onDiscard, onStay }: {
  open: boolean;
  preview?: boolean;
  t: Messages["manage"];
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={styles.dialog} onCancel={(event) => { event.preventDefault(); onStay(); }}>
    <h2>{preview ? t.previewStaleTitle : t.leaveTitle}</h2>
    <p>{preview ? t.previewStaleBody : t.leaveBody}</p>
    <div className={styles.dialogActions}>
      <button type="button" onClick={onSave}>{t.saveAndLeave}</button>
      <button type="button" onClick={onDiscard}>{t.discardAndLeave}</button>
      <button type="button" onClick={onStay}>{t.stay}</button>
    </div>
  </dialog>;
}

export function SaveBar({ dirty, busy, saved, error, t, onSave }: {
  dirty: boolean;
  busy: boolean;
  saved: boolean;
  error: string | null;
  t: Messages["manage"];
  onSave: () => void;
}) {
  let status: ReactNode = null;
  if (busy) status = t.pending;
  else if (error) status = error;
  else if (dirty) status = t.unsaved;
  else if (saved) status = t.savedNow;
  return <div className={styles.saveBar}>
    <p role={error ? "alert" : "status"}>{status}</p>
    <button type="button" onClick={onSave} disabled={!dirty || busy} aria-busy={busy}>{busy ? t.pending : t.save}</button>
  </div>;
}
