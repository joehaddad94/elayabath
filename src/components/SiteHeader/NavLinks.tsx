"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/nav";
import styles from "./SiteHeader.module.css";

export interface NavItem {
  href: string;
  label: string;
  /** Extra URL roots that belong to this item, for sections whose detail
   *  pages do not sit under the item's own href. */
  match?: string[];
}

/**
 * Marks the current page for assistive technology, and for sighted visitors
 * through the accent colour.
 *
 * A client component only because aria-current depends on the URL, and the
 * header is rendered once in the layout rather than per page.
 *
 * The comparison is in `lib/nav.ts` rather than inline here. It had been
 * inline, and it had been wrong on every route since the header was written:
 * `usePathname()` returns `/en/about` while the href is `/about`, so nothing
 * ever matched and nothing was ever marked. A pure function has tests; a
 * conditional buried in JSX does not.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className={styles.links}>
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
