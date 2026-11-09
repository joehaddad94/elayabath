"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_PAGES } from "@/lib/site-content/fields";
import styles from "./site.module.css";

/** The list of the site's pages, beside whichever one is open. It lives in the
 *  section's layout, so it stays put and clickable while the next page loads. */
export function SitePages() {
  const pathname = usePathname();
  return (
    <nav className={styles.pages} aria-label="Site pages">
      {SITE_PAGES.map((p) => {
        const href = `/admin/site/${p.slug}`;
        return (
          <Link key={p.slug} href={href} aria-current={pathname === href ? "page" : undefined}>
            {p.title}
          </Link>
        );
      })}
    </nav>
  );
}
