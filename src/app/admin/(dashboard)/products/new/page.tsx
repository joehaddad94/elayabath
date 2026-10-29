import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../../admin.module.css";
import { NewProductForm } from "./NewProductForm";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { supabase } = await requireStaff();
  const { data: categories } = await supabase.from("categories").select("id, name, status").order("position");

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/products">Products</Link> / New
      </p>
      <div className={styles.pageHead}>
        <div>
          <h1>New product</h1>
          <p>It starts hidden, with a code, a name and a category. Everything else is filled in next.</p>
        </div>
      </div>
      <NewProductForm
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.status === "active" ? c.name : `${c.name} (hidden)` }))}
      />
    </>
  );
}
