import type { Metadata } from "next";
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
  const [live, drafts, discontinued, categoriesLive, categoryDrafts, finishes, sharedCodes] = (
    await Promise.all([
      supabase.from("products").select("id", head).eq("status", "active"),
      supabase.from("products").select("id", head).eq("status", "draft"),
      supabase.from("products").select("id", head).eq("status", "discontinued"),
      supabase.from("categories").select("id", head).eq("status", "active"),
      supabase.from("categories").select("id", head).eq("status", "draft"),
      supabase.from("finishes").select("id", head),
      supabase.from("duplicate_finish_codes").select("code", head),
    ])
  ).map((r) => r.count ?? 0) as [number, number, number, number, number, number, number];

  const { data: recent } = await supabase
    .from("revisions")
    .select("entity_type, version, note, published_by, published_at, snapshot")
    .order("published_at", { ascending: false })
    .limit(8);

  const stats: Array<[string, number]> = [
    ["Products live", live],
    ["Products in draft", drafts],
    ["Discontinued", discontinued],
    ["Categories live", categoriesLive],
    ["Categories in draft", categoryDrafts],
    ["Finishes", finishes],
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
        {stats.map(([label, value]) => (
          <div key={label} className={styles.stat}>
            <span className={styles.statValue}>{value.toLocaleString("en")}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      {sharedCodes > 0 && (
        <section className={styles.section}>
          <h2>Needs a decision</h2>
          <p className={styles.message}>
            {sharedCodes} finish code{sharedCodes === 1 ? " is" : "s are"} shared by more than one
            finish in the client&apos;s data. A quote that names one of these codes cannot say which
            finish it means. P08 is both Polished Copper and Polished Rose Gold.
          </p>
        </section>
      )}

      <section className={styles.section}>
        <h2>Recently published</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">Name</th>
              <th scope="col">Version</th>
              <th scope="col">By</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((r, i) => {
              const s = r.snapshot as { name?: string; sku?: string; code?: string };
              return (
                <tr key={i}>
                  <td>{r.entity_type}</td>
                  <td>{[s.sku ?? s.code, s.name].filter(Boolean).join(" · ")}</td>
                  <td>{r.version}</td>
                  <td className={styles.muted}>{r.published_by}</td>
                  <td className={styles.muted}>
                    {new Date(r.published_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
