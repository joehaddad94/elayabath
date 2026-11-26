import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../../admin.module.css";
import { NewProductForm } from "./NewProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { supabase } = await requireStaff();
  const [{ data: categories }, { data: collections }] = await Promise.all([
    supabase.from("categories").select("id, name, status").order("position"),
    supabase.from("collections").select("id, name, category_id").order("name"),
  ]);

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/products">Products</Link> / New
      </p>
      <div className={styles.pageHead}>
        <div>
          <h1>New product</h1>
          <p>
            It starts hidden, with a code, a name and a collection (which sets its category). Everything else is filled in next.
            For a new collection, make it in <Link href="/admin/collections#new-collection">Collections</Link> first.
          </p>
        </div>
      </div>
      <NewProductForm
        groups={(categories ?? []).map((c) => ({
          name: c.status === "active" ? c.name : `${c.name} (hidden)`,
          collections: (collections ?? []).filter((x) => x.category_id === c.id).map((x) => ({ id: x.id, name: x.name })),
        }))}
      />
    </>
  );
}
