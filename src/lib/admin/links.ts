/** A link to the products grid with its toolbar filters set, in the same
 *  form the grid writes to its own address. */
export function gridLink(toolbar: { q?: string; category?: string; status?: string; incomplete?: boolean; importJob?: string }): string {
  return `/admin/products?state=${encodeURIComponent(JSON.stringify({ toolbar }))}`;
}
