import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HOMEPAGE_PRODUCTS } from "@/content/homepage";
import { requireStaff } from "@/lib/admin/session";
import { HOME_PRODUCTS_KEY, categoryAsset, sitePage } from "@/lib/site-content/fields";
import { toPickerProduct, type PickerProduct } from "../picker";
import { SiteEditor, type Tile } from "../SiteEditor";

export const metadata: Metadata = { title: "Site content" };

export default async function SiteContentPage({ params }: { params: Promise<{ page: string }> }) {
  const { page: slug } = await params;
  const page = sitePage(slug);
  if (!page) notFound();
  const { supabase } = await requireStaff();

  const { data: rows, error } = await supabase.from("site_content").select("key, value");
  if (error) throw new Error(`Site content couldn't be read: ${error.message}`);
  const content = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));

  let tiles: Tile[] = [];
  let products: PickerProduct[] = [];
  if (page.slug === "home") {
    const chosen = content[HOME_PRODUCTS_KEY];
    const ids = Array.isArray(chosen) ? chosen.filter((id): id is string => typeof id === "string") : null;
    const columns = "id, slug, name, sku, category_name, image_path, status";
    const [categories, picked] = await Promise.all([
      supabase.from("categories").select("id, slug, name, version, blurb, image, icon").eq("status", "active").order("position"),
      ids
        ? supabase.from("admin_products").select(columns).in("id", ids)
        : supabase.from("admin_products").select(columns).in("slug", [...HOMEPAGE_PRODUCTS]).eq("status", "active"),
    ]);
    tiles = (categories.data ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      version: c.version,
      blurb: c.blurb,
      image: c.image,
      icon: c.icon,
      imageUrl: categoryAsset(c.image),
      iconUrl: categoryAsset(c.icon),
    }));
    // In the chosen order (or the fixed list's, before anyone has chosen).
    const rowsByKey = new Map((picked.data ?? []).map((p) => [ids ? p.id : p.slug, p]));
    products = (ids ?? HOMEPAGE_PRODUCTS).flatMap((key) => {
      const row = rowsByKey.get(key);
      return row ? [toPickerProduct(row)] : [];
    });
  }

  return <SiteEditor key={page.slug} pageSlug={page.slug} content={content} tiles={tiles} products={products} />;
}
