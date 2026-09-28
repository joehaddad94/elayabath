import styles from "../admin.module.css";

/**
 * Shown the moment a dashboard link is followed, while the next screen
 * loads: the header stays, and the page area says it is on its way, so a
 * click never looks as if it did nothing.
 */
export default function Loading() {
  return (
    <div className={styles.skeleton} role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <span className={styles.skeletonTitle} aria-hidden="true" />
      <span className={styles.skeletonLine} aria-hidden="true" />
      <span className={styles.skeletonBlock} aria-hidden="true" />
      <span className={styles.skeletonBlock} aria-hidden="true" />
    </div>
  );
}
