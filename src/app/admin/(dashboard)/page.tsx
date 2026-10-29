import type { Metadata } from "next";
import Link from "next/link";
import { gridLink } from "@/lib/admin/links";
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
  const [live, drafts, waiting, discontinued, categoriesLive, categoryDrafts, finishes, sharedCodes] = (
    await Promise.all([
      supabase.from("products").select("id", head).eq("status", "active"),
      supabase.from("products").select("id", head).eq("status", "draft"),
      supabase.from("admin_products").select("id", head).eq("has_changes", true),
      supabase.from("products").select("id", head).eq("status", "discontinued"),
      supabase.from("categories").select("id", head).eq("status", "active"),
      supabase.from("categories").select("id", head).eq("status", "draft"),
      supabase.from("finishes").select("id", head),
      supabase.from("duplicate_finish_codes").select("code", head),
    ])
  ).map((r) => r.count ?? 0) as [number, number, number, number, number, number, number, number];

  const { data: usage } = await supabase.rpc("storage_usage");
  const stored = (usage ?? []).reduce((sum, r) => sum + Number(r.bytes), 0);

  // Each card opens what it counts. "Never published" and "waiting to be
  // published" are different sets: the second also holds live products
  // with edits not yet published, which is why it can be the larger.
  const stats: Array<[string, number, string]> = [
    ["Products live", live, gridLink({ status: "active" })],
    ["Waiting to be published", waiting, gridLink({ changes: true })],
    ["Never published", drafts, gridLink({ status: "draft" })],
    ["Discontinued", discontinued, gridLink({ status: "discontinued" })],
    ["Categories live", categoriesLive, "/admin/categories"],
    ["Categories in draft", categoryDrafts, "/admin/categories"],
    ["Finishes", finishes, "/admin/finishes"],
  ];

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Overview</h1>
          <p>The catalogue as the public site sees it, and what is waiting.</p>
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
