import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { ProductsGrid } from "./ProductsGrid";

export const metadata: Metadata = { title: "Products" };

/**
 * Every product in the working copy, drafts included, in AG Grid.
 *
 * The page loads only what the grid's menus need (categories and types);
 * the rows themselves are paged in by the grid from
 * /api/admin/products as it scrolls.
 */
export default async function ProductsPage() {
  const { supabase } = await requireStaff();

  const [categories, types] = await Promise.all([
    supabase.from("categories").select("id, slug, name").order("position"),
    supabase.from("product_types").select("id, name, category_id").order("name"),
  ]);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Products</h1>
          <p>
            Saving changes the site straight away. A hidden product stays off the site until it is made
            visible, one at a time or in bulk.
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">
          New product
        </Link>
      </div>
      <ProductsGrid
        categories={categories.data ?? []}
        types={(types.data ?? []).map((t) => ({ id: t.id, name: t.name, categoryId: t.category_id }))}
      />
    </>
  );
}
