import type { Metadata } from "next";
import Link from "next/link";
import { authorLabel, gridLink } from "@/lib/admin/links";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";

export const metadata: Metadata = { title: "Activity" };

const PAGE = 30;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qatar" });

const KIND: Record<string, string> = { product: "Product", category: "Category", finish: "Finish" };

/** The grid, filtered to products with unpublished changes. */
const CHANGES_LINK = gridLink({ changes: true });

/**
 * Who changed what, and when: every publish, newest first, and the edits
 * still waiting to be published. Each publish is a version in the history,
 * so everything listed here can be compared and restored from its editor.
 */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before } = await searchParams;
  const { supabase } = await requireStaff();
  // Paged by id, which only ever increases, rather than by time: the seed
  // published hundreds of versions within the same instant.
  const cursor = before && /^\d{1,18}$/.test(before) ? Number(before) : null;

  let published = supabase
    .from("revisions")
    .select("id, entity_type, entity_id, version, note, published_by, published_at, snapshot")
    .order("id", { ascending: false })
    .limit(PAGE + 1);
  if (cursor) published = published.lt("id", cursor);

  const [{ data: events }, { data: waiting, count: waitingCount }] = await Promise.all([
    published,
    supabase
      .from("admin_products")
      .select("id, sku, name, updated_by, updated_at, published_version", { count: "exact" })
      .eq("has_changes", true)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);
  const rows = (events ?? []).slice(0, PAGE);
  const more = (events ?? []).length > PAGE;

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Activity</h1>
          <p>Every publish, newest first, and the edits still waiting to go live.</p>
        </div>
      </div>

      {!cursor && (
        <section aria-labelledby="waiting-heading">
          <h2 id="waiting-heading" className={styles.sectionTitle}>
            Waiting to be published ({(waitingCount ?? 0).toLocaleString("en")})
          </h2>
          {(waiting ?? []).length === 0 ? (
            <p className={styles.muted}>Nothing: the site shows every saved change.</p>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">State</th>
                    <th scope="col">Last edited by</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(waiting ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/products/${p.id}`}>{p.sku}</Link> · {p.name}
                      </td>
                      <td>{p.published_version === null ? "Never published" : "Changed since publishing"}</td>
                      <td className={styles.muted}>{p.updated_by ?? "not recorded"}</td>
                      <td className={styles.muted}>{p.updated_at ? when(p.updated_at) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(waitingCount ?? 0) > (waiting ?? []).length && (
                <p>
                  <Link href={CHANGES_LINK}>All {(waitingCount ?? 0).toLocaleString("en")} in the grid</Link>, where they
                  can be published together.
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className={styles.section} aria-labelledby="published-heading">
        <h2 id="published-heading">Published</h2>
        {rows.length === 0 ? (
          <p className={styles.muted}>Nothing{cursor ? " earlier" : " yet"}.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What</th>
                <th scope="col">Version</th>
                <th scope="col">By</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = r.snapshot as { name?: string; sku?: string; code?: string };
                const label = [s.sku ?? s.code, s.name].filter(Boolean).join(" · ");
                return (
                  <tr key={r.id}>
                    <td className={styles.muted}>{when(r.published_at)}</td>
                    <td>
                      {KIND[r.entity_type] ?? r.entity_type}:{" "}
                      {r.entity_type === "product" ? <Link href={`/admin/products/${r.entity_id}`}>{label}</Link> : label}
                    </td>
                    <td>{r.version}</td>
                    <td className={styles.muted}>{authorLabel(r.published_by)}</td>
                    <td className={styles.muted}>{r.note ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className={styles.pager}>
          {cursor && <Link href="/admin/activity">Newest</Link>}
          {more && <Link href={`/admin/activity?before=${rows[rows.length - 1]!.id}`}>Earlier</Link>}
        </p>
      </section>
    </>
  );
}
