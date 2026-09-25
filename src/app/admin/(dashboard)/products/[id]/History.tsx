"use client";

import { useMemo, useState } from "react";
import { authorLabel } from "@/lib/admin/links";
import admin from "../../../admin.module.css";
import styles from "./editor.module.css";

/** A published version, as `public.product_snapshot` stored it. */
export interface ProductSnapshotView {
  sku: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  type: { slug: string; name: string };
  dimensions: string | null;
  description: string;
  features: string[];
  status: string;
  gallery?: Array<{ path: string; alt: string; caption?: string | null }>;
  finishes: string[];
  datasheet: string | null;
}

export interface Revision {
  id: number;
  version: number;
  publishedBy: string | null;
  publishedAt: string;
  note: string | null;
  snapshot: ProductSnapshotView;
}

/** Both sides of a comparison in one shape: a published version, or what is
 *  on screen now. */
export interface Comparable {
  name: string;
  sku: string;
  slug: string;
  category: string;
  type: string;
  description: string;
  dimensions: string;
  features: string[];
  finishes: string[];
  photos: string[];
  alts: string[];
  datasheet: string | null;
  status: string;
}

const STATUS: Record<string, string> = { active: "Live", discontinued: "Discontinued", draft: "Draft" };

export function fromSnapshot(s: ProductSnapshotView, finishName: (slug: string) => string): Comparable {
  const gallery = s.gallery ?? [];
  return {
    name: s.name,
    sku: s.sku,
    slug: s.slug,
    category: s.categoryName,
    // An untyped product's snapshot carries its category as its type.
    type: s.type.slug === s.categorySlug ? "Not set" : s.type.name,
    description: s.description,
    dimensions: s.dimensions ?? "",
    features: s.features,
    finishes: s.finishes.map(finishName),
    photos: gallery.map((g) => g.path),
    alts: gallery.map((g) => g.alt),
    datasheet: s.datasheet,
    status: STATUS[s.status] ?? s.status,
  };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qatar" });

const list = (items: string[]) => (items.length ? items.join(", ") : "none");

/** The fields that differ, in words a person can check at a glance. */
function differences(then: Comparable, now: Comparable): Array<{ field: string; then: string; now: string }> {
  const rows: Array<{ field: string; then: string; now: string }> = [];
  const text = (field: string, a: string, b: string) => {
    if (a !== b) rows.push({ field, then: a || "empty", now: b || "empty" });
  };
  text("Name", then.name, now.name);
  text("Item code", then.sku, now.sku);
  text("Web address", then.slug, now.slug);
  text("Category", then.category, now.category);
  text("Type", then.type, now.type);
  text("Status", then.status, now.status);
  text("Dimensions", then.dimensions, now.dimensions);
  text("Description", then.description, now.description);
  if (then.features.join("\n") !== now.features.join("\n")) {
    rows.push({ field: "Features", then: list(then.features), now: list(now.features) });
  }
  if (then.finishes.join() !== now.finishes.join()) {
    const added = now.finishes.filter((f) => !then.finishes.includes(f));
    const removed = then.finishes.filter((f) => !now.finishes.includes(f));
    const detail = [added.length && `added ${added.join(", ")}`, removed.length && `removed ${removed.join(", ")}`]
      .filter(Boolean)
      .join("; ");
    rows.push({ field: "Finishes", then: `${then.finishes.length}`, now: `${now.finishes.length}${detail ? ` (${detail})` : " (reordered)"}` });
  }
  if (then.photos.join() !== now.photos.join()) {
    const main = then.photos[0] !== now.photos[0] ? "; main photo changed" : "";
    rows.push({ field: "Photographs", then: `${then.photos.length}`, now: `${now.photos.length}${main}` });
  } else if (then.alts.join("\n") !== now.alts.join("\n")) {
    rows.push({ field: "Alt text", then: "as it was", now: "changed" });
  }
  if (then.datasheet !== now.datasheet) {
    rows.push({ field: "Data sheet", then: then.datasheet ? "a PDF" : "none", now: now.datasheet ? (then.datasheet ? "a different PDF" : "a PDF") : "none" });
  }
  return rows;
}

/**
 * Every published version of the product, newest first. Choosing one shows
 * how it differs from what is on screen now; restoring it copies it back as
 * a draft, which goes live only when published again.
 */
export function History({
  revisions,
  publishedVersion,
  current,
  finishName,
  busy,
  onRestore,
}: {
  revisions: Revision[];
  publishedVersion: number | null;
  current: Comparable;
  finishName: (slug: string) => string;
  busy: boolean;
  onRestore: (revision: Revision) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(revisions[0]?.id ?? null);
  const revision = revisions.find((r) => r.id === chosen);
  const diff = useMemo(
    () => (revision ? differences(fromSnapshot(revision.snapshot, finishName), current) : []),
    [revision, current, finishName],
  );

  if (revisions.length === 0) {
    return <p className={styles.hint}>Not published yet, so there is no history. Each publish adds a version here.</p>;
  }

  return (
    <div className={styles.history}>
      <ol className={styles.versions} aria-label="Published versions">
        {revisions.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`${styles.version} ${r.id === chosen ? styles.versionChosen : ""}`}
              aria-pressed={r.id === chosen}
              onClick={() => setChosen(r.id)}
            >
              <span>
                Version {r.version}
                {r.version === publishedVersion && r.id === revisions[0]?.id && (
                  <span className={admin.badge}>Live</span>
                )}
              </span>
              <span className={styles.meta}>
                {when(r.publishedAt)}
                {` · ${authorLabel(r.publishedBy)}`}
              </span>
              {r.note && <span className={styles.meta}>{r.note}</span>}
            </button>
          </li>
        ))}
      </ol>

      {revision && (
        <section className={styles.diff} aria-live="polite">
          <h3>
            Version {revision.version} compared with what is on screen now
          </h3>
          {diff.length === 0 ? (
            <p className={styles.hint}>No differences.</p>
          ) : (
            <table className={admin.table}>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Version {revision.version}</th>
                  <th scope="col">Now</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={d.field}>
                    <th scope="row">{d.field}</th>
                    <td className={styles.diffCell}>{d.then}</td>
                    <td className={styles.diffCell}>{d.now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || diff.length === 0}
              onClick={() => onRestore(revision)}
            >
              Restore version {revision.version} as a draft
            </button>
          </div>
          <p className={styles.hint}>
            Restoring replaces the draft with this version, photos and data sheet included. The site is
            unchanged until you publish. Featured and manual order are kept as they are now.
          </p>
        </section>
      )}
    </div>
  );
}
