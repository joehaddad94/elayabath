"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { format, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import type { SearchResults } from "@/lib/types";
import styles from "./SearchBox.module.css";

/**
 * Asks the server as the visitor types, a moment after they pause.
 *
 * It used to download the whole catalogue index and match in the browser.
 * The matching rules are unchanged; they now run in the database, so the page
 * costs the same at 60 products or 60,000, and nothing about the catalogue
 * ships to a visitor who never searches.
 */
const NOTHING: SearchResults = { collections: [], products: [] };

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
  // Results are stored with the query they answer, so a slow response for an
  // earlier query can never be shown against a later one.
  const [answer, setAnswer] = useState<{ query: string; hits: SearchResults } | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    // A short pause before asking: one request per word typed, not per key.
    const timer = setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : NOTHING))
        .then((hits: SearchResults) => setAnswer({ query: q, hits }))
        .catch(() => {
          /* aborted by the next keystroke, or offline: keep the last answer */
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const asked = query.trim().length > 0;
  const current = asked && answer?.query === query.trim();
  const hits = current ? answer.hits : NOTHING;
  const found = hits.collections.length + hits.products.length > 0;

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
        {current && (
          <p className={styles.count}>
            {found
              ? format(t.search.resultsFor, { q: query.trim() })
              : t.search.noResults}
          </p>
        )}

        {/* Matching collections first, as a section of their own; the
            products below still put an exact item code first. */}
        {hits.collections.length > 0 && (
          <>
            <h2 className={styles.group}>{t.search.collections}</h2>
            <ul className={styles.results}>
              {hits.collections.map((entry) => (
                <li key={`${entry.cs}/${entry.s}`}>
                  <Link className={styles.hit} href={routes.collection(entry.cs, entry.s, locale)}>
                    <span className={styles.name}>{entry.n}</span>
                    <span className={styles.sku}>{t.search.collectionLabel}</span>
                    <span className={styles.meta}>{entry.c}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {hits.collections.length > 0 && hits.products.length > 0 && (
          <h2 className={styles.group}>{t.search.products}</h2>
        )}
        {hits.products.length > 0 && (
          <ul className={styles.results}>
            {hits.products.map((entry) => (
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
