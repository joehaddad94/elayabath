"use client";

import DashboardError from "./(dashboard)/error";
import styles from "./admin.module.css";

/**
 * The same screen one level up. The staff check runs in the dashboard's
 * frame (its layout), and an error boundary only catches what is below it,
 * so a check that fails while the database is unreachable lands here rather
 * than in (dashboard)/error.tsx. Without this, the frame's loading line would
 * stay on screen for good.
 */
export default function AdminError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className={styles.main}>
      <DashboardError {...props} />
    </main>
  );
}
