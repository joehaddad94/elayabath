import styles from "./site.module.css";
import { SitePages } from "./SitePages";

/** The page list on the left, the open page beside it. Only the page side
 *  changes (and shows its loading placeholder) when another page is picked. */
export default function SiteContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <SitePages />
      {children}
    </div>
  );
}
