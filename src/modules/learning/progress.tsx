import type { Locale } from "@/i18n";
import { learningLabels } from "./labels";
import { progressPercent } from "./service";
import styles from "./learning.module.css";

export function Progress({ locale, completed, total }: { locale: Locale; completed: number; total: number }) {
  const text = learningLabels[locale];
  const percent = progressPercent(completed, total);
  const finished = total > 0 && completed === total;
  return (
    <div className={styles.progress}>
      <div>
        <span>{finished ? text.finished : text.progress}</span>
        <strong>{completed} / {total} · {percent}%</strong>
      </div>
      <progress aria-label={`${text.progress}: ${percent}%`} value={completed} max={total || 1} />
    </div>
  );
}
