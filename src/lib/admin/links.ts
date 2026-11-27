/** The Products list's filters, as its address carries them. */
export interface ListFilters {
  q?: string;
  /** A category's slug. */
  category?: string;
  /** A collection's id, or "none" for products without one. */
  collection?: string;
  status?: "visible" | "hidden";
  missing?: boolean;
  /** A collection's id, chosen in advance as where ticked products move. */
  move?: string;
}

/** A link to the Products list with these filters set, in the same form the
 *  list writes to its own address. */
export function listLink(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.collection) params.set("collection", filters.collection);
  if (filters.status) params.set("status", filters.status);
  if (filters.missing) params.set("missing", "1");
  if (filters.move) params.set("move", filters.move);
  const query = params.toString();
  return `/admin/products${query ? `?${query}` : ""}`;
}
