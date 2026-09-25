import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { ProductsGrid, type SavedView } from "./ProductsGrid";

export const metadata: Metadata = { title: "Products" };

/**
 * Every product in the working copy, drafts included, in AG Grid.
 *
 * The page loads only what the grid's menus need (categories, types, saved
 * views); the rows themselves are paged in by the grid from
 * /api/admin/products as it scrolls.
 */
export default async function ProductsPage() {
  const { supabase, email } = await requireStaff();

  const [categories, types, views] = await Promise.all([
    supabase.from("categories").select("id, slug, name").order("position"),
    supabase.from("product_types").select("id, name, category_id").order("name"),
    supabase.from("grid_views").select("id, name, owner, shared, column_state, filter_model").order("name"),
  ]);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Products</h1>
          <p>
            Edits save as drafts. Nothing changes on the site until it is published, one product at a
            time or in bulk.
          </p>
        </div>
      </div>
      <ProductsGrid
        me={email}
        categories={categories.data ?? []}
        types={(types.data ?? []).map((t) => ({ id: t.id, name: t.name, categoryId: t.category_id }))}
        views={(views.data ?? []) as unknown as SavedView[]}
      />
    </>
  );
}
