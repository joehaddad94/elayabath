"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon/Icon";
import { format, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import {
  clearShortlist,
  getShortlistServerSnapshot,
  getShortlistSnapshot,
  parseShortlist,
  removeFromShortlist,
  subscribeToShortlist,
} from "@/lib/shortlist";
import styles from "./Shortlist.module.css";

/**
 * The shortlist as it appears above the enquiry form: what the enquiry is
 * about, in words, before anybody fills anything in.
 *
 * Renders nothing when the list is empty, so the contact page is unchanged
 * for somebody who arrived without one.
 */
export function ShortlistPanel({ locale, t }: { locale: Locale; t: Dictionary }) {
  const raw = useSyncExternalStore(
    subscribeToShortlist,
    getShortlistSnapshot,
    getShortlistServerSnapshot,
  );
  const items = useMemo(() => parseShortlist(raw), [raw]);

  if (items.length === 0) return null;

  return (
    <div className={`${styles.panel} blueprint`}>
      <div className={styles.panelHead}>
        <h3>{format(t.shortlist.heading, { n: items.length })}</h3>
        <button type="button" className={styles.clear} onClick={clearShortlist}>
          {t.shortlist.clear}
        </button>
      </div>

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.sku}>
            <div className={styles.itemText}>
              <Link href={routes.product(item.slug, locale)}>{item.name}</Link>
              <span className={styles.itemMeta}>
                {item.sku}
                {item.finish ? ` · ${item.finish}` : ""}
              </span>
            </div>
            <button
              type="button"
              className={styles.remove}
              onClick={() => removeFromShortlist(item.sku)}
            >
              <Icon name="close" size={14} />
              <span className="sr-only">
                {format(t.shortlist.remove, { name: item.name })}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className={styles.note}>{t.shortlist.note}</p>
    </div>
  );
}
