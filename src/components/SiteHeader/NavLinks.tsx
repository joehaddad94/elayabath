"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
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
 * A client component only because `aria-current` depends on the URL, and the
 * header is rendered once in the layout rather than per page. The category
 * data arrives as plain props from the server component above: a client
 * component must never import `lib/catalogue.ts`, which pulls every product
 * record into the browser bundle.
 *
 * The menu opens in CSS, on hover and focus-within, so it works before
 * hydration and with scripting off. Below
 * the wrap breakpoint it is switched off entirely and the item behaves as the
 * plain link it always was, because there is no hover on a phone and the
 * index page it leads to already lists the categories.
 *
 * What CSS cannot do is close it. The header lives in the layout and survives
 * navigation, so after a click the link keeps focus and `:focus-within` held
 * the menu open until the visitor clicked somewhere else. Picking an item or
 * pressing Escape therefore marks the section closed, which overrides hover
 * and focus until the pointer comes back in or focus re-enters from outside.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [closed, setClosed] = useState<string | null>(null);

  function closeOnPick(event: MouseEvent<HTMLDivElement>, href: string) {
    if (!(event.target as Element).closest("a")) return;
    setClosed(href);
    // Drop the focus the click left behind, or `:focus-within` reopens the
    // menu as soon as the pointer leaves.
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>, href: string) {
    if (event.key !== "Escape") return;
    // Back to the section's own link, so a keyboard visitor keeps their place.
    event.currentTarget.querySelector<HTMLElement>("a")?.focus();
    setClosed(href);
  }

  return (
    <div className={styles.links}>
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.match);
        const link = (
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={styles.link}
          >
            {item.label}
            {item.panel && (
              <Icon name="chevron" size={13} className={styles.chevron} />
            )}
          </Link>
        );

        if (!item.panel) return <div key={item.href}>{link}</div>;

        return (
          <div
            key={item.href}
            className={styles.section}
            data-closed={closed === item.href ? "" : undefined}
            onClick={(event) => closeOnPick(event, item.href)}
            onKeyDown={(event) => closeOnEscape(event, item.href)}
            onPointerEnter={() => setClosed(null)}
            onFocus={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setClosed(null);
            }}
          >
            {link}
            <div className={styles.panel}>
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
