import type { SearchEntry } from "./types";

/**
 * The index, fetched on demand from `/api/search-index`.
 *
 * Deliberately NOT in lib/catalogue.ts. That module holds every catalogue
 * record, so a client component importing anything from it drags the whole
 * catalogue into the browser bundle: routing search through it once put a
 * 45 KB chunk of product records in front of every visitor who opened the
 * search page. This module imports no data at all; the index arrives over
 * the network, only when search is actually used.
 */
export async function loadSearchIndex(): Promise<SearchEntry[]> {
  const response = await fetch("/api/search-index");
  if (!response.ok) throw new Error(`search index: ${response.status}`);
  return (await response.json()) as SearchEntry[];
}

/**
 * Matching, kept separate from the component so it is a pure function of its
 * inputs and can be reasoned about on its own.
 *
 * Deliberately not fuzzy. The people this has to serve most are specifiers
 * arriving from a drawing or a data sheet with an exact item code, and fuzzy
 * matching on a code turns a precise query into a list of near misses. Every
 * term has to match somewhere in the record, so adding a word narrows rather
 * than widens.
 */

export interface SearchHit {
  entry: SearchEntry;
  /** Lower sorts first. */
  rank: number;
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function searchCatalogue(
  index: readonly SearchEntry[],
  query: string,
  limit = 40,
): SearchHit[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const compact = normalise(query);
  const hits: SearchHit[] = [];

  for (const entry of index) {
    const haystack = `${entry.n} ${entry.k} ${entry.t} ${entry.c}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) continue;

    // An exact item code beats everything: that query has one right answer.
    // Punctuation is stripped on both sides so "e02 sw40034" still lands.
    const sku = normalise(entry.k);
    const name = entry.n.toLowerCase();
    const rank =
      sku === compact
        ? 0
        : sku.startsWith(compact) && compact.length > 2
          ? 1
          : name === terms.join(" ")
            ? 2
            : name.startsWith(terms[0] ?? "")
              ? 3
              : 4;

    hits.push({ entry, rank });
  }

  return hits
    .sort((a, b) => a.rank - b.rank || a.entry.n.localeCompare(b.entry.n))
    .slice(0, limit);
}
