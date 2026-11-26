/**
 * The vocabulary of a category shelf: what can be selected and how it sorts.
 *
 * Filtering, facet counting and sorting run in the database (public.shelf,
 * see supabase/migrations/…_shelf.sql, specified by
 * supabase/tests/shelf.test.sql). The site reads the unfiltered shelf for a
 * category's counts and its finishes; since collections (2026-11-26) a
 * category page lists collections, not a filtered shelf of products.
 */

export interface Selection {
  type: string[];
  material: string[];
  colour: string[];
}

export const SORT_KEYS = ["default", "name", "name-desc", "finishes", "code"] as const;

export type SortKey = (typeof SORT_KEYS)[number];
