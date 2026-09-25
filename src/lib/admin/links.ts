/** A link to the products grid with its toolbar filters set, in the same
 *  form the grid writes to its own address. */
export function gridLink(toolbar: { q?: string; category?: string; status?: string; incomplete?: boolean; changes?: boolean; importJob?: string }): string {
  return `/admin/products?state=${encodeURIComponent(JSON.stringify({ toolbar }))}`;
}

/** Who published something, as a person reads it. The database records
 *  "system" for anything done with the service key: the seed, a move, a
 *  script. */
export function authorLabel(by: string | null | undefined): string {
  if (!by) return "not recorded";
  return by === "system" ? "Seed or script" : by;
}
