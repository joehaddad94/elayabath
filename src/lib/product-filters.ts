import type { FacetOption, Product } from "./types";

/**
 * Filtering, faceting and sorting for a category shelf.
 *
 * Pure and data-free, so it can be tested without a DOM and used from a
 * client component without dragging the catalogue into the browser bundle.
 * It was inline in ProductBrowser, where none of it could be tested and the
 * facet counts were quietly wrong.
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

/** Does this product satisfy one axis of the selection? An empty axis is not
 *  a constraint, and within an axis the values are an OR: picking two colours
 *  means either, which is what a buyer means by ticking two boxes. */
function matchesAxis(product: Product, axis: Axis, values: string[]): boolean {
  if (values.length === 0) return true;
  if (axis === "type") return values.includes(product.type.slug);
  if (axis === "material") return product.materials.some((m) => values.includes(m));
  return product.finishes.some((f) => values.includes(f));
}

export function filterProducts(products: Product[], selection: Selection): Product[] {
  return products.filter((product) =>
    (Object.keys(selection) as Axis[]).every((axis) =>
      matchesAxis(product, axis, selection[axis]),
    ),
  );
}

/**
 * Counts for one axis's options, given what is selected on the *other* axes.
 *
 * This is the part that was wrong. The counts came from the category record,
 * so they were catalogue-wide totals that never moved: a shelf could read
 * "Showing 0 of 10" while every facet beside it still advertised products,
 * which leaves the visitor clicking boxes to find out which ones are lies.
 *
 * An option is counted against everything that matches the other axes, and
 * not against its own axis, so the number reads as "what I would get if I
 * added this" rather than "what I have".
 */
export function facetCounts(
  products: Product[],
  selection: Selection,
  axis: Axis,
  options: FacetOption[],
): FacetOption[] {
  const others: Selection = { ...selection, [axis]: [] };
  const pool = filterProducts(products, others);

  return options.map((option) => ({
    ...option,
    count: pool.filter((product) => matchesAxis(product, axis, [option.value]))
      .length,
  }));
}

/** The client lists products in their own order, which carries no meaning we
 *  can see, so it stays the default rather than being replaced by one. */
export function sortProducts(products: Product[], key: SortKey): Product[] {
  const copy = [...products];
  const byName = (a: Product, b: Product) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  switch (key) {
    case "name":
      return copy.sort(byName);
    case "name-desc":
      return copy.sort((a, b) => byName(b, a));
    case "finishes":
      // Most choice first. Ties keep their catalogue order, which matters
      // because a great many products share a finish count.
      return copy.sort((a, b) => b.finishes.length - a.finishes.length);
    case "code":
      return copy.sort((a, b) =>
        a.sku.localeCompare(b.sku, undefined, { numeric: true }),
      );
    default:
      return copy;
  }
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
