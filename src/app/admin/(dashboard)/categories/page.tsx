import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { CategoryOrder, type CategoryRow } from "./CategoryOrder";
import { NewCategoryForm } from "./NewCategoryForm";

export const metadata: Metadata = { title: "Categories" };

/** The categories in menu order, with what each holds and its state. */
export default async function CategoriesPage() {
  const { supabase } = await requireStaff();
  const [{ data: categories }, { data: tallies }] = await Promise.all([
    supabase.from("categories").select("id, slug, name, status, position, version, published_version").order("position"),
    supabase.from("category_counts").select("category_id, products, live"),
  ]);
  const counts = new Map((tallies ?? []).map((t) => [t.category_id, { total: t.products, live: t.live }]));

  const rows: CategoryRow[] = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.published_version === null ? "Draft" : c.status === "discontinued" ? "Hidden" : "Live",
    changes: c.published_version !== null && c.version !== c.published_version,
    products: counts.get(c.id)?.total ?? 0,
    live: counts.get(c.id)?.live ?? 0,
  }));

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Categories</h1>
          <p>
            In the order the site&apos;s menu shows them. Drag to reorder, then publish the order. Open a category to
            edit its name, description, types and the order of its products.
          </p>
        </div>
      </div>
      <CategoryOrder categories={rows} />
      <section className={styles.section} aria-labelledby="new-category">
        <h2 id="new-category">New category</h2>
        <NewCategoryForm />
      </section>
    </>
  );
}
