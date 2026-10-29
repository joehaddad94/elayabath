import styles from "../../admin.module.css";

/** While the products load: the page's shape, so nothing jumps when the list
 *  arrives. */
export default function Loading() {
  return (
    <div className={styles.skeleton} role="status" aria-live="polite">
      <span className="sr-only">Loading the products</span>
      <span className={styles.skeletonTitle} aria-hidden="true" />
      <span className={styles.skeletonLine} aria-hidden="true" />
      <div aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <span className={styles.skeletonSquare} />
            <span className={styles.skeletonLines}>
              <span className={styles.skeletonLine} />
              <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
