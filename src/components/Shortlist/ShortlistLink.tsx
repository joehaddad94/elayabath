"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon/Icon";
import { format } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import {
  getShortlistServerSnapshot,
  getShortlistSnapshot,
  parseShortlist,
  subscribeToShortlist,
} from "@/lib/shortlist";
import styles from "./Shortlist.module.css";

/**
 * The header's route back to a shortlist in progress.
 *
 * Renders nothing until there is something in it. The header was just cut
 * back to make room on a phone, and a control that is empty for most visits
 * has not earned permanent space in it.
 */
export function ShortlistLink({ locale, label }: { locale: Locale; label: string }) {
  const raw = useSyncExternalStore(
    subscribeToShortlist,
    getShortlistSnapshot,
    getShortlistServerSnapshot,
  );
  const count = useMemo(() => parseShortlist(raw).length, [raw]);

  if (count === 0) return null;

  return (
    <Link
      className={styles.headerLink}
      href={`${routes.contact(locale)}#enquiry`}
      aria-label={format(label, { n: count })}
    >
      <Icon name="list" />
      <span className={styles.badge}>{count}</span>
    </Link>
  );
}
