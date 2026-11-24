import { LocaleStatus } from "@/components/locale-status";
import styles from "./loading.module.css";

export default function Loading() {
  return (
    <div className={styles.slot}>
      <LocaleStatus kind="loading" />
    </div>
  );
}
