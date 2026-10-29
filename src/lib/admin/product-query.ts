import "server-only";
import type { z } from "zod";
import { condition, type GridState } from "./grid-state";
import type { serverClient } from "@/lib/supabase/server";

/**
 * Turns the products grid's state into a database query.
 *
 * Shared by two callers that must agree exactly: the route that pages rows
 * into the grid, and the bulk actions that apply to "everything matching the
 * current filter". If they built their queries separately, a bulk action
 * could touch rows the grid never showed.
 *
 * Every column name that reaches the query is checked against a whitelist.
 * The grid sends column ids and filter types; nothing from it is spliced into
 * SQL.
 */

type Client = Awaited<ReturnType<typeof serverClient>>;

/** Grid column id -> view column, for everything that can sort or filter. */
const COLUMNS = {
  sku: "sku",
  name: "name",
  category: "category_name",
  type: "type_name",
  status: "status",
  featured: "featured",
  dimensions: "dimensions",
  finishes: "finish_count",
  completeness: "completeness",
  updated: "updated_at",
  updatedBy: "updated_by",
} as const;
type ColumnId = keyof typeof COLUMNS;
const isColumn = (id: string): id is ColumnId => id in COLUMNS;



/**
 * A search value, made safe for a PostgREST `or()` expression. Commas,
 * brackets, dots and quotes are that syntax, and % _ * are wildcards; none of
 * them appears in a product name or item code a person would search for, so
 * they are dropped rather than escaped through two layers of syntax. The
 * result is always double-quoted where it is used.
 */
const clean = (value: string) =>
  value.replace(/[%_*\\"(),]/g, " ").replace(/\s+/g, " ").trim();

/** One condition as a PostgREST filter expression, for use inside `or()`. */
function expression(column: string, c: z.infer<typeof condition>): string | null {
  if (c.filterType === "text") {
    const v = clean(c.filter ?? "");
    switch (c.type) {
      case "contains": return `${column}.ilike."*${v}*"`;
      case "notContains": return `${column}.not.ilike."*${v}*"`;
      case "equals": return `${column}.ilike."${v}"`;
      case "notEqual": return `${column}.not.ilike."${v}"`;
      case "startsWith": return `${column}.ilike."${v}*"`;
      case "endsWith": return `${column}.ilike."*${v}"`;
      case "blank": return `${column}.is.null`;
      case "notBlank": return `${column}.not.is.null`;
    }
  }
  const n = c.filter ?? 0;
  switch (c.type) {
    case "equals": return `${column}.eq.${n}`;
    case "notEqual": return `${column}.neq.${n}`;
    case "lessThan": return `${column}.lt.${n}`;
    case "lessThanOrEqual": return `${column}.lte.${n}`;
    case "greaterThan": return `${column}.gt.${n}`;
    case "greaterThanOrEqual": return `${column}.gte.${n}`;
    case "inRange": return `and(${column}.gte.${n},${column}.lte.${c.filterTo ?? n})`;
    case "blank": return `${column}.is.null`;
    case "notBlank": return `${column}.not.is.null`;
  }
  return null;
}

/**
 * Applies the grid state to a query on `admin_products`. Generic over the
 * query builder so the same filters serve a page of rows and a list of ids.
 */
export { gridStateSchema, type GridState } from "./grid-state";

/** The four query-builder methods the grid state needs. Typed loosely on
 *  purpose: the builder's own signatures are generic over the table's
 *  columns, and the columns reaching this point have already been checked
 *  against the whitelist above. */
interface Filterable {
  or(filters: string): this;
  eq(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this;
}

export function applyGridState<Q extends Filterable>(
  query: Q,
  state: GridState,
  withSort: boolean,
): Q {
  let q = query;

  if (state.q.trim()) {
    const term = clean(state.q);
    if (term) q = q.or(`name.ilike."*${term}*",sku.ilike."*${term}*"`);
  }
  if (state.category) q = q.eq("category_slug", state.category);
  if (state.status) q = q.eq("status", state.status);
  if (state.incomplete) q = q.lt("completeness", 6);
  if (state.importJob) q = q.eq("import_job_id", state.importJob);

  // One condition per column; columns combine with AND.
  for (const [colId, f] of Object.entries(state.filter)) {
    if (!isColumn(colId)) continue;
    const expr = expression(COLUMNS[colId], f);
    if (expr) q = q.or(`and(${expr})`);
  }

  if (withSort) {
    const sorts = state.sort.filter((s) => isColumn(s.colId));
    for (const s of sorts) {
      q = q.order(COLUMNS[s.colId as ColumnId], { ascending: s.sort === "asc", nullsFirst: false });
    }
    // A stable tail, so paging never repeats or skips a row between blocks.
    q = q.order("category_position").order("position").order("sku");
  }
  return q;
}

export const ADMIN_PRODUCT_COLUMNS =
  "id, sku, slug, name, category_id, category_slug, category_name, type_id, type_name, status, " +
  "featured, position, dimensions, has_datasheet, image_path, finish_count, completeness, missing, " +
  "published_version, version, updated_at, updated_by";

/** Every id matching the state, for bulk actions. Paged, so a very large
 *  catalogue is read in slices rather than one unbounded request. */
export async function matchingIds(supabase: Client, state: GridState): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await applyGridState(
      supabase.from("admin_products").select("id"),
      state,
      true,
    ).range(from, from + 999);
    if (error) throw new Error(error.message);
    ids.push(...(data ?? []).flatMap((r) => (r.id ? [r.id] : [])));
    if ((data ?? []).length < 1000) return ids;
  }
}
