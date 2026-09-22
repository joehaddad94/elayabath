import Link from "next/link";
import { Fragment } from "react";
import styles from "./Breadcrumbs.module.css";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * An ordered list, because the order carries meaning: this is a path through
 * the site, not a row of chips. The separator is decorative and hidden from
 * assistive technology, which reads the list structure instead.
 */
export function Breadcrumbs({
  items,
  label,
}: {
  items: Crumb[];
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ol className={styles.crumbs}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li>
                {item.href && !last ? (
                  <Link href={item.href}>{item.label}</Link>
                ) : (
                  <span className={styles.current} aria-current="page">
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li className={styles.sep} aria-hidden="true">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
