"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { format, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import { loadSearchIndex, searchCatalogue } from "@/lib/search";
import type { SearchEntry } from "@/lib/types";
import styles from "./SearchBox.module.css";

/**
 * The index is loaded on demand rather than bundled with the page.
 *
 * At 50 products it would hardly matter; at 596 it is about 45 KB that every
 * visitor who never opens search would pay for. A dynamic import gives it its
 * own chunk, fetched the first time this component mounts, and the page is
 * useful before it arrives.
 */
export function SearchBox({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const id = useId();
  // Seeded from the URL so the header's form, which is a plain GET, arrives
  // here with its query already run. It also makes a result page a link
  // somebody can send to a colleague.
  const initial = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSearchIndex().then((entries) => {
      if (!cancelled) setIndex(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hits = useMemo(
    () => (index ? searchCatalogue(index, query) : []),
    [index, query],
  );

  const asked = query.trim().length > 0;

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor={id}>
        {t.search.label}
      </label>
      <input
        className={`input ${styles.input}`}
        id={id}
        type="search"
        autoComplete="off"
        placeholder={t.search.placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p className={styles.hint}>{t.search.hint}</p>

      <div aria-live="polite">
        {asked && (
          <p className={styles.count}>
            {hits.length > 0
              ? format(t.search.resultsFor, { q: query.trim() })
              : t.search.noResults}
          </p>
        )}

        {hits.length > 0 && (
          <ul className={styles.results}>
            {hits.map(({ entry }) => (
              <li key={entry.s}>
                <Link className={styles.hit} href={routes.product(entry.s, locale)}>
                  <span className={styles.name}>{entry.n}</span>
                  <span className={styles.sku}>{entry.k}</span>
                  <span className={styles.meta}>
                    {entry.t} · {entry.c}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
