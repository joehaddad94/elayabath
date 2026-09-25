/**
 * The vocabulary of a category shelf: what can be selected, how it sorts, and
 * how the selection reads back as chips.
 *
 * Filtering, facet counting and sorting themselves run in the database now
 * (public.shelf, see supabase/migrations/…_shelf.sql). They used to run here,
 * in the browser, over every product in the category. The tests that
 * specified them were ported case for case to supabase/tests/shelf.test.sql,
 * so the meaning did not change when the place did.
 *
 * Data-free, so client components can use it without reaching the catalogue.
 */

export interface Selection {
  type: string[];
  material: string[];
  colour: string[];
}

export type Axis = keyof Selection;

export const EMPTY_SELECTION: Selection = { type: [], material: [], colour: [] };

export const SORT_KEYS = ["default", "name", "name-desc", "finishes", "code"] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && (SORT_KEYS as readonly string[]).includes(value);
}

export function countSelected(selection: Selection): number {
  return (Object.keys(selection) as Axis[]).reduce(
    (total, axis) => total + selection[axis].length,
    0,
  );
}

/** Every selected value, flattened, so the applied-filter chips can be
 *  rendered in one pass and each one knows how to remove itself. */
export function appliedFilters(
  selection: Selection,
  labels: Record<Axis, Map<string, string>>,
): Array<{ axis: Axis; value: string; label: string }> {
  return (Object.keys(selection) as Axis[]).flatMap((axis) =>
    selection[axis].map((value) => ({
      axis,
      value,
      label: labels[axis].get(value) ?? value,
    })),
  );
}

/** The query string for a shelf request, shared by the browser and the
 *  route so they cannot disagree about its shape. */
export function shelfQuery(
  category: string,
  selection: Selection,
  sort: SortKey,
  offset: number,
  limit: number,
): string {
  const params = new URLSearchParams({ category, sort, offset: String(offset), limit: String(limit) });
  for (const axis of Object.keys(selection) as Axis[]) {
    if (selection[axis].length > 0) params.set(axis, selection[axis].join(","));
  }
  return params.toString();
}
