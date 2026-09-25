import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAll } from "@/lib/admin/fetch-all";
import { requireStaff } from "@/lib/admin/session";
import { storageUrl } from "@/lib/supabase/config";
import styles from "../../../admin.module.css";
import { CategoryEditor } from "./CategoryEditor";

export const metadata: Metadata = { title: "Edit category" };

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaff();

  const [{ data: category }, { data: types }, { data: typeCounts }, products] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_types").select("id, slug, name").eq("category_id", id).order("name"),
    supabase.from("type_counts").select("type_id, products").eq("category_id", id),
    fetchAll((from, to) =>
      supabase
        .from("admin_products")
        .select("id, sku, name, status, image_path, position")
        .eq("category_id", id)
        .order("position")
        .order("name")
        .range(from, to),
    ),
  ]);
  if (!category) notFound();
  const used = new Map((typeCounts ?? []).map((t) => [t.type_id, t.products]));

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/categories">Categories</Link> / {category.name}
      </p>
      <CategoryEditor
        key={category.id}
        category={{
          id: category.id,
          version: category.version,
          publishedVersion: category.published_version,
          updatedAt: category.updated_at,
          updatedBy: category.updated_by,
          form: {
            name: category.name,
            slug: category.slug,
            blurb: category.blurb,
            status: category.status,
            types: (types ?? []).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
          },
        }}
        typeUse={Object.fromEntries((types ?? []).map((t) => [t.id, used.get(t.id) ?? 0]))}
        products={products.map((p) => ({
          // A view's columns are all nullable to the type generator; these
          // come from not-null table columns.
          id: p.id!,
          sku: p.sku ?? "",
          name: p.name ?? "",
          status: p.status ?? "draft",
          imageUrl: p.image_path ? storageUrl("product-media", p.image_path) : null,
        }))}
      />
    </>
  );
}
