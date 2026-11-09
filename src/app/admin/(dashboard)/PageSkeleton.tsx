import styles from "../admin.module.css";

/**
 * The placeholder a dashboard screen shows while it loads: a title, a line
 * and two blocks, so a click never looks as if it did nothing. Used by the
 * loading.tsx files, one per section, because a section's own loading screen
 * is the only one that covers moving between its pages.
 */
export function PageSkeleton() {
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
