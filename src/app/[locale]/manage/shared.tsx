import type { Messages } from "@/i18n";
import { SubmitButton } from "@/components/submit-button";
import { editorMessage } from "./editor-message";
import styles from "./manage.module.css";

export function Notice({ notice, t }: { notice?: string; t: Messages["manage"] }) {
  if (!notice || !["saved", "removed", "replaced", "invalid", "denied", "stale", "duplicate", "publish", "video", "file", "file-size", "price", "cover", "category"].includes(notice)) return null;
  const success = notice === "saved" || notice === "removed" || notice === "replaced";
  return <p className={styles.notice} role={success ? "status" : "alert"}>{editorMessage(notice, t)}</p>;
}

type Action = (form: FormData) => Promise<void>;
export function Move({ rows, index, action, t, tab = "plan" }: {
  rows: { id: string }[]; index: number; action: Action; t: Messages["manage"]; tab?: string;
}) {
  return <div className={styles.moves}>{(["up", "down"] as const).map((direction) => {
    const neighbor = rows[index + (direction === "up" ? -1 : 1)];
    if (!neighbor) return null;
    return <form key={direction} action={action}>
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="target" value={rows[index].id} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="neighbor" value={neighbor.id} />
      <SubmitButton pending={t.pending}>{direction === "up" ? "↑" : "↓"} {t[direction]}</SubmitButton>
    </form>;
  })}</div>;
}
