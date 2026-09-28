import Link from "next/link";
import styles from "../admin.module.css";

/** An address inside the dashboard that leads nowhere: most often a product,
 *  category or import that has since been deleted, or a link copied wrong. */
export default function DashboardNotFound() {
  return (
    <div className={styles.problem}>
      <h1>Not found</h1>
      <p>
        Nothing is at this address. It may have been deleted since the link was made, or the link may be
        incomplete.
      </p>
      <div className={styles.problemActions}>
        <Link href="/admin/products" className="btn btn-primary">
          Go to products
        </Link>
        <Link href="/admin" className="btn btn-secondary">
          Go to the overview
        </Link>
      </div>
    </div>
  );
}
