/**
 * Reads every row of a query, a page at a time. The API returns at most
 * 1,000 rows per request (`max_rows` in supabase/config.toml), so a list that
 * must be whole, such as every product in a category for ordering, is read
 * in pages rather than silently cut short.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}
