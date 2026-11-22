import type { Locale } from "@/i18n";
import { learningLabels } from "./labels";
import styles from "./learning.module.css";

export function Progress({ locale, completed, total }: { locale: Locale; completed: number; total: number }) {
  const text = learningLabels[locale];
  return (
    <div className={styles.progress}>
      <div><span>{total > 0 && completed === total ? text.finished : text.progress}</span> <strong>{completed} / {total}</strong></div>
      <progress aria-label={text.progress} value={completed} max={total || 1} />
    </div>
  );
}
