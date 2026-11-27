"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/Icon/Icon";
import { isActive } from "@/lib/nav";
import styles from "./SiteHeader.module.css";

export interface NavPanelItem {
  href: string;
  label: string;
  count: number;
}

export interface NavItem {
  href: string;
  label: string;
  /** Extra URL roots that belong to this item, for sections whose detail
   *  pages do not sit under the item's own href. */
  match?: string[];
  /** Turns this item into a section with a menu beneath it. */
  panel?: NavPanelItem[];
  panelAllLabel?: string;
}

/**
 * Primary navigation, with a menu under any item that has one.
 *
 * Marks the current page for assistive technology through `aria-current`, and
 * for sighted visitors through both a colour and a rule. Colour alone was
 * carrying it, and the accent measured *lower* contrast than the inactive
 * links beside it, so the current page read as quieter than its neighbours
 * rather than louder.
 *
 * The category data arrives as plain props from the server component above: a
 * client component must never import `lib/catalogue.ts`, which pulls every
 * product record into the browser bundle.
 *
 * A section with a menu is a disclosure button: a click or tap opens it, and
 * picking an item, Escape, a click outside or focus leaving it closes it. It
 * used to open on hover while also being a link to the products index, so one
 * control did two things: it flashed open as the pointer crossed the header,
 * a click navigated instead of opening, and on a touch screen it could never
 * be opened at all. The index is the menu's first entry instead.
 *
 * Below the wrap breakpoint the header row scrolls sideways and would clip the
 * menu, so there the item stays the plain link it always was: CSS swaps the
 * button for it.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState(pathname);
  const sectionRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Back and forward navigate without a click on the menu: close it then too.
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(null);
  }

  // Close on a press anywhere outside the open section.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!sectionRef.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    setOpen(null);
    // Back to the button, so a keyboard visitor keeps their place.
    event.currentTarget.querySelector<HTMLElement>("button")?.focus();
  }

  return (
    <div className={styles.links}>
      {items.map((item, index) => {
        const active = isActive(pathname, item.href, item.match);
        const link = (className: string | undefined) => (
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {item.label}
          </Link>
        );

        if (!item.panel) return <div key={item.href}>{link(styles.link)}</div>;

        const expanded = open === item.href;
        return (
          <div
            key={item.href}
            ref={expanded ? sectionRef : undefined}
            className={styles.section}
            data-open={expanded ? "" : undefined}
            onKeyDown={closeOnEscape}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null);
            }}
          >
            {link(`${styles.link} ${styles.narrowOnly}`)}
            <button
              type="button"
              className={`${styles.link} ${styles.toggle}`}
              aria-expanded={expanded}
              aria-controls={`${panelId}-${index}`}
              data-active={active ? "" : undefined}
              onClick={() => setOpen(expanded ? null : item.href)}
            >
              {item.label}
              <Icon name="chevron" size={13} className={styles.chevron} />
            </button>
            <div
              id={`${panelId}-${index}`}
              className={styles.panel}
              onClick={(event) => {
                if ((event.target as Element).closest("a")) setOpen(null);
              }}
            >
              <ul>
                {item.panelAllLabel && (
                  <li>
                    <Link href={item.href} className={styles.panelAll}>
                      {item.panelAllLabel}
                    </Link>
                  </li>
                )}
                {item.panel.map((entry) => (
                  <li key={entry.href}>
                    <Link href={entry.href}>
                      <span>{entry.label}</span>
                      <span className={styles.panelCount}>{entry.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
