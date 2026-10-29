"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon/Icon";
import styles from "../admin.module.css";

export interface AdminNavItem {
  href: string;
  label: string;
}

/**
 * The dashboard's sections, marking the one you are in.
 *
 * On a wide screen they are a row of links. On a phone they fold behind a
 * Menu button naming the current section, so the page starts with its own
 * content rather than three rows of navigation; choosing a section closes it.
 */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const current = items.find((i) => isActive(i.href))?.label ?? "Menu";

  return (
    <>
      <button
        type="button"
        className={styles.menuToggle}
        aria-expanded={open}
        aria-controls="dashboard-sections"
        onClick={() => setOpen((o) => !o)}
      >
        {current} <Icon name="chevron" size={16} className={open ? styles.chevronOpen : undefined} />
        <span className="sr-only">, show sections</span>
      </button>
      <nav id="dashboard-sections" className={`${styles.nav} ${open ? styles.navOpen : ""}`} aria-label="Dashboard">
        {items.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
