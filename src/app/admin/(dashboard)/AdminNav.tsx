"use client";

import Link, { useLinkStatus } from "next/link";
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

  // A section is its first path segment after /admin, so a link that opens a
  // section part-way in (Site content opens on /admin/site/home) still marks
  // the whole section.
  const isActive = (href: string) => {
    const section = href.split("/").slice(0, 3).join("/");
    return section === "/admin" ? pathname === "/admin" : pathname === section || pathname.startsWith(`${section}/`);
  };
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
            <Pending />
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Underlines the section you just clicked the moment you click it, while the
 *  next screen is on its way, so a click never looks as if it did nothing. */
function Pending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={`${styles.navPending} ${pending ? styles.navPendingOn : ""}`} />;
}
