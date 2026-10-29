import type { Metadata } from "next";
import Link from "next/link";
import { listLink } from "@/lib/admin/links";
import { STORAGE_QUOTA_BYTES, formatBytes } from "@/lib/admin/media";
import { requireStaff } from "@/lib/admin/session";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: "Overview" };

/**
 * Where the dashboard opens: the state of the catalogue at a glance, and
 * the things that need someone's attention.
 */
export default async function Overview() {
  const { supabase } = await requireStaff();

  const head = { count: "exact" as const, head: true };
  const [visible, hidden, incomplete, categoriesVisible, categories, finishes, sharedCodes] = (
    await Promise.all([
      // What the site shows, counted from the site's own copy.
      supabase.from("published_products").select("product_id", head).eq("status", "active"),
      supabase.from("products").select("id", head).eq("status", "draft"),
      supabase.from("admin_products").select("id", head).lt("completeness", 6),
      supabase.from("published_categories").select("category_id", head).eq("status", "active"),
      supabase.from("categories").select("id", head),
      supabase.from("finishes").select("id", head),
      supabase.from("duplicate_finish_codes").select("code", head),
    ])
  ).map((r) => {
    // A count that failed is not a zero: show the error screen with "Try again".
    if (r.error) throw new Error(`The overview couldn't be counted: ${r.error.message}`);
    return r.count ?? 0;
  }) as [number, number, number, number, number, number, number];

  const { data: usage } = await supabase.rpc("storage_usage");
  const stored = (usage ?? []).reduce((sum, r) => sum + Number(r.bytes), 0);

  // Each card opens what it counts.
  const stats: Array<[string, number, string]> = [
    ["Products on the site", visible, listLink({ status: "visible" })],
    ["Products hidden", hidden, listLink({ status: "hidden" })],
    ["Products missing details", incomplete, listLink({ missing: true })],
    ["Categories visible", categoriesVisible, "/admin/categories"],
    ["Categories hidden", categories - categoriesVisible, "/admin/categories"],
    ["Finishes", finishes, "/admin/finishes"],
  ];

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Overview</h1>
          <p>The catalogue at a glance. Every save changes the site straight away.</p>
        </div>
      </div>

      <div className={styles.stats}>
        {stats.map(([label, value, href]) => (
          <Link key={label} href={href} className={styles.stat}>
            <span className={styles.statValue}>{value.toLocaleString("en")}</span>
            <span className={styles.statLabel}>{label}</span>
          </Link>
        ))}
        <div className={styles.stat}>
          <span className={styles.statValue}>{((stored / STORAGE_QUOTA_BYTES) * 100).toFixed(0)}%</span>
          <span className={styles.statLabel}>
            Storage used, {formatBytes(stored)} of {formatBytes(STORAGE_QUOTA_BYTES)}
          </span>
        </div>
      </div>

      {sharedCodes > 0 && (
        <section className={styles.section}>
          <h2>Needs a decision</h2>
          <p className={styles.message}>
            {sharedCodes} finish code{sharedCodes === 1 ? " is" : "s are"} shared by more than one
            finish in the client&apos;s data. A quote that names one of these codes cannot say which
            finish it means. P08 is both Polished Copper and Polished Rose Gold.{" "}
            <Link href="/admin/finishes?only=shared">See them in the finish library</Link>
          </p>
        </section>
      )}

    </>
  );
}
