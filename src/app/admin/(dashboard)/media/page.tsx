import type { Metadata } from "next";
import { STORAGE_QUOTA_BYTES, formatBytes } from "@/lib/admin/media";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../admin.module.css";
import { CleanupButton } from "./CleanupButton";

export const metadata: Metadata = { title: "Media" };

const BUCKETS: Record<string, string> = {
  "product-media": "Product photographs",
  datasheets: "Data sheets",
  swatches: "Finish swatches",
  imports: "Uploaded spreadsheets",
};

/**
 * What Storage holds, against the plan's allowance, and what nothing uses.
 *
 * Nothing is removed automatically. A file stays while the working copy, the
 * live site or any published version uses it, so restoring an old version
 * always brings its photos back; the rest can be cleared here.
 */
export default async function MediaPage() {
  const { supabase } = await requireStaff();
  const [usage, unused] = await Promise.all([supabase.rpc("storage_usage"), supabase.rpc("unused_media")]);

  const rows = usage.data ?? [];
  const total = rows.reduce((sum, r) => sum + Number(r.bytes), 0);
  const share = total / STORAGE_QUOTA_BYTES;
  const unusedFiles = unused.data ?? [];
  const unusedBytes = unusedFiles.reduce((sum, f) => sum + Number(f.bytes), 0);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Media</h1>
          <p>Photographs, data sheets and swatches in storage, and what nothing uses any more.</p>
        </div>
      </div>

      <section aria-labelledby="storage-heading">
        <h2 id="storage-heading" className={styles.sectionTitle}>Storage used</h2>
        <p className={styles.meterText}>
          <strong>{formatBytes(total)}</strong> of {formatBytes(STORAGE_QUOTA_BYTES)} ({(share * 100).toFixed(1)}%)
          {share > 0.8 && " · nearly full: remove unused files, or move to a larger plan before uploads start failing"}
        </p>
        <meter className={styles.meter} min={0} max={1} low={0.6} high={0.8} optimum={0} value={Math.min(1, share)}>
          {(share * 100).toFixed(1)}%
        </meter>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Kind</th>
              <th scope="col">Files</th>
              <th scope="col">Size</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bucket_id}>
                <td>{BUCKETS[r.bucket_id] ?? r.bucket_id}</td>
                <td>{Number(r.files).toLocaleString("en")}</td>
                <td>{formatBytes(Number(r.bytes))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section} aria-labelledby="unused-heading">
        <h2 id="unused-heading">Unused files</h2>
        {unusedFiles.length === 0 ? (
          <p className={styles.muted}>
            None. Every stored file is used by a product, the live site or a published version. Uploads from
            the last day are left alone while their product is being edited.
          </p>
        ) : (
          <p>
            {unusedFiles.length.toLocaleString("en")} file{unusedFiles.length === 1 ? "" : "s"},{" "}
            {formatBytes(unusedBytes)}: uploads that were never saved to a product, or replaced before
            they were ever published.
          </p>
        )}
        {/* Always in the same place, so its result survives the refresh that
            follows a cleanup. */}
        <CleanupButton count={unusedFiles.length} />
      </section>
    </>
  );
}
