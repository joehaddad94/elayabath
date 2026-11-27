import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listLink } from "@/lib/admin/links";
import { requireStaff } from "@/lib/admin/session";
import { storageUrl } from "@/lib/supabase/config";
import styles from "../../../admin.module.css";
import { CollectionEditor } from "./CollectionEditor";

export const metadata: Metadata = { title: "Edit collection" };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaff();

  const [{ data: collection }, { data: products }, { data: counts }] = await Promise.all([
    supabase.from("collections").select("id, name, slug, description, image_path, category_id, categories(name, slug)").eq("id", id).maybeSingle(),
    supabase
      .from("admin_products")
      .select("id, sku, name, status, image_path")
      .eq("collection_id", id)
      .order("position")
      .order("name"),
    supabase.from("collection_counts").select("live, category_live").eq("collection_id", id).maybeSingle(),
  ]);
  if (!collection) notFound();

  const list = (products ?? []).map((p) => ({
    id: p.id!,
    sku: p.sku ?? "",
    name: p.name ?? "",
    visible: p.status === "active",
    imageUrl: p.image_path ? storageUrl("product-media", p.image_path) : null,
  }));

  // What the site reads: a live product in it, in a live category.
  const hasLive = (counts?.live ?? 0) > 0;
  const categoryLive = counts?.category_live ?? false;
  const onSite = hasLive && categoryLive;
  const offSiteReason = onSite
    ? null
    : list.length === 0
      ? "It has no products yet."
      : !hasLive
        ? "None of its products is visible."
        : "Its category is hidden.";

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/collections">Collections</Link> / {collection.categories?.name} / {collection.name}
      </p>
      <CollectionEditor
        key={collection.id}
        collection={{
          id: collection.id,
          categoryName: collection.categories?.name ?? "",
          categorySlug: collection.categories?.slug ?? "",
          form: {
            name: collection.name,
            slug: collection.slug,
            description: collection.description,
            image_path: collection.image_path,
          },
        }}
        photoUrl={collection.image_path ? storageUrl("site-media", collection.image_path) : null}
        fallbackUrl={list.find((p) => p.visible && p.imageUrl)?.imageUrl ?? null}
        products={list}
        onSite={onSite}
        offSiteReason={offSiteReason}
        addProductsLink={listLink({ category: collection.categories?.slug, move: collection.id })}
      />
    </>
  );
}
