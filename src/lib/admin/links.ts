/** The Products list's filters, as its address carries them. */
export interface ListFilters {
  q?: string;
  /** A category's slug. */
  category?: string;
  status?: "visible" | "hidden";
  missing?: boolean;
}

/** A link to the Products list with these filters set, in the same form the
 *  list writes to its own address. */
export function listLink(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.missing) params.set("missing", "1");
  const query = params.toString();
  return `/admin/products${query ? `?${query}` : ""}`;
}
