import type { Messages } from "@/i18n";
import styles from "./manage.module.css";

export function Notice({ notice, t }: { notice?: string; t: Messages["manage"] }) {
  const notices: Record<string, string> = {
    saved: t.saved, invalid: t.invalid, denied: t.denied, stale: t.stale, duplicate: t.duplicate,
    publish: t.publishError, video: t.videoError, file: t.fileError,
  };
  if (!notice || !Object.hasOwn(notices, notice)) return null;
  return <p className={styles.notice} role={notice === "saved" ? "status" : "alert"}>{notices[notice]}</p>;
}

type Action = (form: FormData) => Promise<void>;
export function Move({ rows, index, action, t }: {
  rows: { id: string }[]; index: number; action: Action; t: Messages["manage"];
}) {
  return <div className={styles.moves}>{(["up", "down"] as const).map((direction) => {
    const neighbor = rows[index + (direction === "up" ? -1 : 1)];
    if (!neighbor) return null;
    return <form key={direction} action={action}>
      <input type="hidden" name="target" value={rows[index].id} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="neighbor" value={neighbor.id} />
      <button type="submit">{direction === "up" ? "↑" : "↓"} {t[direction]}</button>
    </form>;
  })}</div>;
}
