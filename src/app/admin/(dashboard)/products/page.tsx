import type { Metadata } from "next";
import Link from "next/link";
import { fetchAll } from "@/lib/admin/fetch-all";
import { LIST_COLUMNS, toProductRow } from "@/lib/admin/grid-row";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { ProductsList, SORTS, type Filters, type SortKey } from "./ProductsList";

export const metadata: Metadata = { title: "Products" };

/**
 * Every product, working copy, visible and hidden, sent whole with the page.
 *
 * About 600 rows of a dozen short fields is well under what one page of
 * photos weighs, and having them all in the browser makes search, filters,
 * sort and "tick all" instant, with no paging and nothing to wait for.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase } = await requireStaff();
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? params[key] : "");

  const [rows, categories, types] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("admin_products")
        .select(LIST_COLUMNS)
        .order("category_position")
        .order("position")
        .order("sku")
        .order("id")
        .range(from, to),
    ),
    supabase.from("categories").select("id, slug, name").order("position"),
    supabase.from("product_types").select("id, name").order("name"),
  ]);
  // A failed read is not an empty catalogue: show the error screen, with
  // "Try again".
  if (categories.error || types.error) throw new Error("The categories couldn't be loaded.");

  const status = one("status");
  const sort = one("sort");
  const initialFilters: Partial<Filters> = {
    q: one("q").slice(0, 100),
    category: one("category"),
    status: status === "visible" || status === "hidden" ? status : "",
    missing: one("missing") === "1",
    sort: sort in SORTS ? (sort as SortKey) : "site",
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Products</h1>
          <p>Click a product to edit it. Saving, and the Visible switch, change the site straight away.</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">
          New product
        </Link>
      </div>
      <ProductsList
        initialRows={rows.map((r) => toProductRow(r as unknown as Record<string, unknown>))}
        initialFilters={initialFilters}
        categories={categories.data}
        types={types.data}
      />
    </>
  );
}
