import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/admin/session";
import { storageUrl } from "@/lib/supabase/config";
import styles from "../../../admin.module.css";
import { ProductEditor, type EditorProduct, type FinishOption } from "./ProductEditor";

export const metadata: Metadata = { title: "Edit product" };

/**
 * One product's working copy, with everything the editor needs to change it:
 * its categories and types to choose from and the whole finish library.
 * The library is small enough to send whole (87 finishes today, a few
 * hundred at most), which keeps the picker instant.
 */
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, email } = await requireStaff();

  const [product, links, images, live, categories, types, finishes, duplicates] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_finishes").select("finish_id").eq("product_id", id).order("position"),
    supabase.from("product_images").select("path, alt, caption, width, height").eq("product_id", id).order("position").order("created_at"),
    supabase.from("published_products").select("slug, status").eq("product_id", id).maybeSingle(),
    supabase.from("categories").select("id, slug, name, status").order("position"),
    supabase.from("product_types").select("id, slug, name, category_id").order("name"),
    supabase.from("finishes").select("id, slug, code, name, family, swatch_path, status").order("name"),
    supabase.from("duplicate_finish_codes").select("code"),
  ]);
  const p = product.data;
  if (!p) notFound();

  const shared = new Set((duplicates.data ?? []).map((d) => d.code));
  const library: FinishOption[] = (finishes.data ?? []).map((f) => ({
    id: f.id,
    slug: f.slug,
    code: f.code,
    name: f.name,
    family: f.family,
    swatchUrl: f.swatch_path ? storageUrl("swatches", f.swatch_path) : null,
    retired: f.status === "retired",
    sharedCode: shared.has(f.code),
  }));

  const editorProduct: EditorProduct = {
    id: p.id,
    version: p.version,
    publishedVersion: p.published_version,
    updatedAt: p.updated_at,
    updatedBy: p.updated_by,
    live: live.data ? { slug: live.data.slug, status: live.data.status } : null,
    form: {
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      category_id: p.category_id,
      type_id: p.type_id,
      description: p.description,
      dimensions: p.dimensions ?? "",
      features: p.features,
      status: p.status,
      featured: p.featured,
      datasheet_path: p.datasheet_path,
      images: images.data ?? [],
      finishes: (links.data ?? []).map((l) => l.finish_id),
    },
  };

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/products">Products</Link> / {p.sku}
      </p>
      <ProductEditor
        key={p.id}
        product={editorProduct}
        me={email}
        created={created === "1"}
        categories={(categories.data ?? []).map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          draft: c.status === "draft",
        }))}
        types={(types.data ?? []).map((t) => ({ id: t.id, slug: t.slug, name: t.name, categoryId: t.category_id }))}
        library={library}
      />
    </>
  );
}
