import type { Metadata } from "next";
import Link from "next/link";
import { listLink } from "@/lib/admin/links";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { GroupProducts, NewCollectionForm } from "./CollectionForms";

export const metadata: Metadata = { title: "Collections" };

/**
 * Every collection, under its category in menu order, with what each holds.
 * The site lists collections; a collection appears there once one of its
 * products is visible.
 */
export default async function CollectionsPage() {
  const { supabase } = await requireStaff();
  const [categories, collections, counts, loose] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("position"),
    supabase.from("collections").select("id, name, slug, category_id").order("name"),
    supabase.from("collection_counts").select("collection_id, products, live"),
    supabase.from("products").select("id", { count: "exact", head: true }).is("collection_id", null),
  ]);
  if (categories.error || collections.error) throw new Error("The collections couldn't be loaded.");
  const tally = new Map((counts.data ?? []).map((c) => [c.collection_id, c]));
  const without = loose.count ?? 0;

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Collections</h1>
          <p>
            The site lists these where it used to list products: a category shows its collections, and a collection shows its
            products. A collection is on the site once one of its products is visible. Open one to rename it or give it a
            photo and description.
          </p>
        </div>
      </div>

      {without > 0 && (
        <div className={`${styles.message} ${styles.messageError}`} role="status">
          <p>
            {without} product{without === 1 ? " has" : "s have"} no collection, so {without === 1 ? "it isn't" : "they aren't"} on
            the site even if visible.{" "}
            <Link href={listLink({ collection: "none" })}>See {without === 1 ? "it" : "them"}</Link>, give each one a collection
            in its editor, or put them all in collections named after them:
          </p>
          <GroupProducts count={without} />
        </div>
      )}

      {categories.data.map((category) => {
        const own = collections.data.filter((c) => c.category_id === category.id);
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
                    <th scope="col">Products</th>
                    <th scope="col">On the site</th>
                  </tr>
                </thead>
                <tbody>
                  {own.map((c) => {
                    const n = tally.get(c.id);
                    const live = n?.live ?? 0;
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/admin/collections/${c.id}`}>{c.name}</Link>
                        </td>
                        <td>
                          {live} visible of {n?.products ?? 0}
                        </td>
                        <td>
                          {live > 0 ? (
                            <span className={styles.badge}>Visible</span>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgeWarn}`}>Not on the site</span>
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
