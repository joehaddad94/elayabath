import { PageSkeleton } from "../PageSkeleton";
import styles from "./site.module.css";

/** Picking another site page: the page list stays (it is in the layout), and
 *  only the page side shows a placeholder until the new page arrives. */
export default function Loading() {
  return (
    <div className={styles.body}>
      <PageSkeleton />
    </div>
  );
}
