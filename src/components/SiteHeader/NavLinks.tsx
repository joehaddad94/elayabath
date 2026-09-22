"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Marks the current page for assistive technology.
 *
 * A client component only because aria-current depends on the URL, and the
 * header is rendered once in the layout rather than per page. The match is a
 * prefix test so a product page still lights up "Products".
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className={styles.links}>
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
