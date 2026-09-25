import type { Metadata } from "next";
import Link from "next/link";
import { ENTITY_LABEL, type Entity } from "@/lib/admin/import-fields";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { NewImport } from "./NewImport";

export const metadata: Metadata = { title: "Import and export" };

const STATUS: Record<string, string> = {
  uploaded: "Mapping",
  staging: "Checking",
  staged: "Checked, not applied",
  applying: "Applying",
  applied: "Applied as drafts",
  published: "Published",
  discarded: "Discarded",
  failed: "Failed",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qatar" });

const ENTITIES: Entity[] = ["products", "categories", "finishes", "product_finishes"];

export default async function ImportsPage() {
  const { supabase } = await requireStaff();
  const { data: jobs } = await supabase
    .from("import_jobs")
    .select("id, entity, file_name, status, counts, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const exportLink = (entity: Entity, format: string, extra = "") => `/api/admin/export?entity=${entity}&format=${format}${extra}`;

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Import and export</h1>
          <p>
            Bring in a spreadsheet of products, categories, finishes or product finishes, check every row before
            anything changes, and apply it as drafts. Exports import back unchanged.
          </p>
        </div>
      </div>

      <section aria-labelledby="new-import">
        <h2 id="new-import" className={styles.sectionTitle}>New import</h2>
        <NewImport />
      </section>

      <section className={styles.section} aria-labelledby="exports">
        <h2 id="exports">Export</h2>
        <p className={styles.muted}>
          The working copy, drafts included, unless it says live. For a filtered set of products, use Export on the
          Products grid.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">Download</th>
              <th scope="col">Blank template</th>
            </tr>
          </thead>
          <tbody>
            {ENTITIES.map((e) => (
              <tr key={e}>
                <td>{ENTITY_LABEL[e]}</td>
                <td>
                  <span className={styles.linkRow}>
                  <a href={exportLink(e, "xlsx")}>Excel</a>
                  <a href={exportLink(e, "csv")}>CSV</a>
                  {(e === "products" || e === "categories") && <a href={exportLink(e, "xlsx", "&source=published")}>Live, Excel</a>}
                </span>
                </td>
                <td>
                  <span className={styles.linkRow}>
                  <a href={exportLink(e, "xlsx", "&scope=template")}>Excel</a>
                  <a href={exportLink(e, "csv", "&scope=template")}>CSV</a>
                </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section} aria-labelledby="past-imports">
        <h2 id="past-imports">Imports</h2>
        {(jobs ?? []).length === 0 ? (
          <p className={styles.muted}>None yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">What</th>
                <th scope="col">Rows</th>
                <th scope="col">State</th>
                <th scope="col">By</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {(jobs ?? []).map((j) => {
                const counts = j.counts as { total?: number; new?: number; changed?: number; error?: number };
                return (
                  <tr key={j.id}>
                    <td>
                      <Link href={`/admin/imports/${j.id}`}>{j.file_name}</Link>
                    </td>
                    <td>{ENTITY_LABEL[j.entity as Entity]}</td>
                    <td>
                      {(counts.total ?? 0).toLocaleString("en")}
                      {counts.new !== undefined && (
                        <span className={styles.muted}>
                          {" "}
                          · {counts.new} new, {counts.changed ?? 0} changed{counts.error ? `, ${counts.error} errors` : ""}
                        </span>
                      )}
                    </td>
                    <td>{STATUS[j.status] ?? j.status}</td>
                    <td className={styles.muted}>{j.created_by}</td>
                    <td className={styles.muted}>{when(j.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
