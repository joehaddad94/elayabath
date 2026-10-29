import type { Metadata } from "next";
import { fetchAll } from "@/lib/admin/fetch-all";
import { requireStaff } from "@/lib/admin/session";
import { storageUrl } from "@/lib/supabase/config";
import styles from "../../admin.module.css";
import { FeaturedOrder, type FeaturedRow } from "./FeaturedOrder";

export const metadata: Metadata = { title: "Homepage" };

/**
 * The products marked Featured, in the order the homepage shows them.
 * Whether a product is featured is part of the product (set in its editor);
 * the order is set here and goes live as soon as it changes.
 */
export default async function HomepagePage() {
  const { supabase } = await requireStaff();
  const products = await fetchAll((from, to) =>
    supabase
      .from("products")
      .select("id, sku, name, featured_rank, published_products(featured, status)")
      .eq("featured", true)
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("name")
      .order("id")
      .range(from, to),
  );
  const { data: images } = await supabase
    .from("admin_products")
    .select("id, image_path")
    .in("id", products.map((p) => p.id));
  const image = new Map((images ?? []).map((i) => [i.id, i.image_path]));

  const rows: FeaturedRow[] = products.map((p) => {
    const live = p.published_products;
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      imageUrl: image.get(p.id) ? storageUrl("product-media", image.get(p.id)!) : null,
      // Featured but hidden: it shows once the product is made visible.
      pending: !live || !live.featured || live.status !== "active",
    };
  });

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Homepage</h1>
          <p>
            Featured products, in the order the homepage shows them. The homepage shows the first 12. To feature a
            product, tick Featured in its editor and save it.
          </p>
        </div>
      </div>
      <FeaturedOrder products={rows} />
    </>
  );
}
