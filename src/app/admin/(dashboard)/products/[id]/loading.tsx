import styles from "../../../admin.module.css";

/** While a product opens: its title, its fields and the side panel. */
export default function Loading() {
  return (
    <div className={styles.skeleton} role="status" aria-live="polite">
      <span className="sr-only">Loading the product</span>
      <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} aria-hidden="true" />
      <span className={styles.skeletonTitle} aria-hidden="true" />
      <span className={styles.skeletonBlock} aria-hidden="true" />
      <span className={styles.skeletonBlock} aria-hidden="true" />
      <span className={styles.skeletonBlock} aria-hidden="true" />
    </div>
  );
}
