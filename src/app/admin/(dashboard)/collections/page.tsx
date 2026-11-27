import type { Metadata } from "next";
import Link from "next/link";
import { listLink } from "@/lib/admin/links";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { GroupProducts, NewCollectionForm } from "./CollectionForms";

export const metadata: Metadata = { title: "Collections" };

/**
 * Every collection, under its category in menu order and in the order the
 * site lists them (where their first product sits), with what each holds.
 * "On the site" reads what the site reads: a live product in it, in a live
 * category.
 */
export default async function CollectionsPage() {
  const { supabase } = await requireStaff();
  const [categories, collections, counts, loose] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("position"),
    supabase.from("collections").select("id, name, slug, category_id").order("name"),
    supabase.from("collection_counts").select("collection_id, products, live, category_live, first_position"),
    supabase.from("products").select("id", { count: "exact", head: true }).is("collection_id", null),
  ]);
  if (categories.error || collections.error || counts.error) throw new Error("The collections couldn't be loaded.");
  const tally = new Map((counts.data ?? []).map((c) => [c.collection_id, c]));
  const without = loose.count ?? 0;
  // The site's order: by first product, then by name. Empty ones go last.
  const place = (id: string) => tally.get(id)?.first_position ?? Number.MAX_SAFE_INTEGER;
  const ordered = [...collections.data].sort((a, b) => place(a.id) - place(b.id) || a.name.localeCompare(b.name));

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Collections</h1>
          <p>
            The site lists these where it used to list products: a category shows its collections, and a collection shows its
            products. A collection is on the site once one of its products is visible and its category is visible. Each
            category lists them in the site&apos;s order. Open one to rename it, give it a photo, or add products.
          </p>
        </div>
      </div>

      <GroupProducts count={without} seeLink={listLink({ collection: "none" })} />

      {categories.data.map((category) => {
        const own = ordered.filter((c) => c.category_id === category.id);
        return (
          <section key={category.id} className={styles.section} aria-labelledby={`cat-${category.id}`}>
            <h2 id={`cat-${category.id}`}>
              {category.name} <span className={styles.muted}>· {own.length}</span>
            </h2>
            {own.length === 0 ? (
              <p className={styles.muted}>No collections yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Collection</th>
                    <th scope="col">On the site</th>
                  </tr>
                </thead>
                <tbody>
                  {own.map((c) => {
                    const n = tally.get(c.id);
                    const products = n?.products ?? 0;
                    const live = n?.live ?? 0;
                    const categoryLive = n?.category_live ?? false;
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/admin/collections/${c.id}`}>{c.name}</Link>
                        </td>
                        <td>
                          {live > 0 && categoryLive ? (
                            `${live} of ${products} product${products === 1 ? "" : "s"}`
                          ) : (
                            <>
                              <span className={`${styles.badge} ${styles.badgeWarn}`}>Not on the site</span>{" "}
                              <span className={styles.muted}>
                                {products === 0
                                  ? "no products yet"
                                  : live === 0
                                    ? `none of its ${products} product${products === 1 ? " is" : "s are"} visible`
                                    : "its category is hidden"}
                              </span>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      <section className={styles.section} aria-labelledby="new-collection">
        <h2 id="new-collection">New collection</h2>
        <NewCollectionForm categories={categories.data.map((c) => ({ id: c.id, name: c.name }))} />
      </section>
    </>
  );
}
