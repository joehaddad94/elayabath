"use client";

import Link from "next/link";
import styles from "../admin.module.css";

/**
 * When a dashboard screen fails to load. Usually temporary: a dropped
 * connection, or the database waking up after a quiet spell on the free
 * plan. So the first offer is to try again; the reference ties it to the
 * server's log if it keeps happening.
 */
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className={styles.problem} role="alert">
      <h1>This page didn&apos;t load</h1>
      <p>
        Nothing has been lost: saved work is in the database. This is usually a dropped connection, or the database
        waking up after a quiet spell, and trying again a moment later fixes it.
      </p>
      <div className={styles.problemActions}>
        <button type="button" className="btn btn-primary" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/admin" className="btn btn-secondary">
          Go to the overview
        </Link>
      </div>
      {error.digest && <p className={styles.muted}>If it keeps happening, quote reference {error.digest}.</p>}
    </div>
  );
}
