"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIELDS, IDENTITIES, type Entity, type ImportOptions } from "@/lib/admin/import-fields";
import { normaliseHeader } from "@/lib/admin/sheets";
import admin from "../../../admin.module.css";
import styles from "../imports.module.css";
import { applyNext, configureImport, discardImport, publishNext, stageNext } from "../actions";
import { ImportPreview } from "./ImportPreview";

interface JobView {
  id: string;
  entity: Entity;
  status: string;
  counts: Record<string, number>;
  headers: string[];
  columns: Record<string, string>;
  grouped: boolean;
  preset: string | null;
  options: ImportOptions;
  error: string | null;
  tagged: number;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

const OUTCOME_LABEL: Record<string, string> = {
  new: "New",
  changed: "Changed",
  unchanged: "Unchanged",
  skipped: "Skipped",
  error: "Errors",
};

/**
 * One import, step by step: map the columns and choose the rules; check
 * every row; look at what would change; apply it as drafts; then publish it
 * or discard it, as one.
 *
 * Checking, applying and publishing each run as a loop of short requests
 * from here, with progress shown, so no request runs long however big the
 * file is. Leaving the page stops the loop; coming back continues it.
 */
export function ImportJob({
  job,
  sample,
  presets,
}: {
  job: JobView;
  sample: string[][];
  presets: Array<{ name: string; mapping: Record<string, string> }>;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState(job.columns);
  const [options, setOptions] = useState(job.options);
  const [presetName, setPresetName] = useState("");
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(job.error ? { text: job.error, error: true } : null);

  const fields = FIELDS[job.entity];
  const editable = !job.grouped && ["uploaded", "staging", "staged"].includes(job.status);
  const counts = job.counts;
  const toApply = (counts.new ?? 0) + (counts.changed ?? 0);

  const setColumn = (index: number, key: string) =>
    setColumns((c) => {
      const next = Object.fromEntries(Object.entries(c).filter(([i, k]) => i !== String(index) && (key === "" || k !== key)));
      if (key) next[String(index)] = key;
      return next;
    });

  const applyPreset = (name: string) => {
    const preset = presets.find((p) => p.name === name);
    if (!preset) return;
    setColumns(
      Object.fromEntries(
        job.headers.flatMap((h, i) => {
          const key = preset.mapping[normaliseHeader(h)];
          return key ? [[String(i), key]] : [];
        }),
      ),
    );
  };

  const loop = async (label: string, step: () => Promise<{ ok: boolean; error?: string; done?: number; total?: number; remaining?: number }>, total: number) => {
    setNotice(null);
    setProgress({ label, done: 0, total });
    for (;;) {
      const result = await step();
      if (!result.ok) {
        setProgress(null);
        setNotice({ text: result.error ?? "It stopped.", error: true });
        return false;
      }
      const done = result.done ?? total - (result.remaining ?? 0);
      setProgress({ label, done, total: result.total ?? total });
      if ((result.remaining ?? (result.total ?? total) - done) <= 0) break;
    }
    setProgress(null);
    return true;
  };

  const check = async () => {
    const saved = await configureImport({ id: job.id, columns, options, presetName: presetName || undefined });
    if (!saved.ok) return setNotice({ text: saved.error, error: true });
    await loop(
      "Checking rows",
      async () => {
        const r = await stageNext({ id: job.id });
        return r.ok ? { ok: true, done: r.checked, total: r.total } : r;
      },
      counts.total ?? 0,
    );
    router.refresh();
  };

  const continueChecking = async () => {
    await loop(
      "Checking rows",
      async () => {
        const r = await stageNext({ id: job.id });
        return r.ok ? { ok: true, done: r.checked, total: r.total } : r;
      },
      counts.total ?? 0,
    );
    router.refresh();
  };

  const apply = async () => {
    if (!window.confirm(`Apply ${plural(toApply, "change", "changes")} as drafts? Nothing goes live until it is published.`)) return;
    let refused = 0;
    const ok = await loop(
      "Applying",
      async () => {
        const r = await applyNext({ id: job.id });
        if (r.ok) refused += r.refused;
        return r.ok ? { ok: true, remaining: r.remaining } : r;
      },
      toApply,
    );
    if (ok && refused) {
      setNotice({
        text: `${plural(refused, "row was", "rows were")} left alone because someone changed them after the check. They are listed as errors.`,
        error: true,
      });
    }
    router.refresh();
  };

  const publish = async () => {
    if (!window.confirm("Publish everything this import changed? The site shows it straight away.")) return;
    const total = job.entity === "products" || job.entity === "product_finishes" ? job.tagged : toApply;
    await loop("Publishing", async () => publishNext({ id: job.id }), total);
    router.refresh();
  };

  const discard = async () => {
    if (!window.confirm("Discard this import's drafts? New rows it created are deleted, and everything it changed goes back to its live version, including any edits made to those rows since.")) return;
    const result = await discardImport({ id: job.id });
    if (!result.ok) return setNotice({ text: result.error, error: true });
    router.refresh();
  };

  return (
    <div className={styles.job}>
      {progress && (
        <div className={styles.progress} role="status" aria-live="polite">
          <span>
            {progress.label}: {progress.done.toLocaleString("en")} of {progress.total.toLocaleString("en")}
          </span>
          <progress max={Math.max(progress.total, 1)} value={progress.done} />
        </div>
      )}
      {notice && (
        <p className={`${admin.message} ${notice.error ? admin.messageError : ""}`} role={notice.error ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      {/* ── 1. mapping and rules ── */}
      <section className={styles.step} aria-labelledby="step-map">
        <h2 id="step-map">1. Columns and rules</h2>
        {!editable && <p className={admin.muted}>{job.grouped ? "The rows have been grouped per product; start a new import to map them differently." : "Fixed once applied; start a new import to change them."}</p>}
        {editable && presets.length > 0 && (
          <label className={styles.presetPick}>
            Use a saved mapping{" "}
            <select className="input" defaultValue={job.preset ?? ""} onChange={(e) => applyPreset(e.target.value)}>
              <option value="">None</option>
              {presets.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className={styles.scroll}>
          <table className={admin.table}>
            <thead>
              <tr>
                <th scope="col">Column in the file</th>
                <th scope="col">First rows</th>
                <th scope="col">Goes into</th>
              </tr>
            </thead>
            <tbody>
              {job.headers.map((header, i) => (
                <tr key={i}>
                  <th scope="row">{header || `Column ${i + 1}`}</th>
                  <td className={styles.sample}>{sample.map((r) => r[i] ?? "").filter(Boolean).slice(0, 3).join(" · ")}</td>
                  <td>
                    <select
                      className="input"
                      aria-label={`Field for ${header || `column ${i + 1}`}`}
                      value={columns[String(i)] ?? ""}
                      disabled={!editable}
                      onChange={(e) => setColumn(i, e.target.value)}
                    >
                      <option value="">Ignore</option>
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                    {fields.find((f) => f.key === columns[String(i)])?.help && (
                      <span className={admin.muted}> {fields.find((f) => f.key === columns[String(i)])!.help}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <fieldset className={styles.rules} disabled={!editable}>
          <legend className="sr-only">Rules</legend>
          <label>
            Find each row by{" "}
            <select className="input" value={options.identity} onChange={(e) => setOptions({ ...options, identity: e.target.value })}>
              {IDENTITIES[job.entity].map((i) => (
                <option key={i.key} value={i.key}>{i.label}</option>
              ))}
            </select>
          </label>
          <label>
            A blank cell{" "}
            <select className="input" value={options.blanks} onChange={(e) => setOptions({ ...options, blanks: e.target.value as ImportOptions["blanks"] })}>
              <option value="keep">leaves the field as it is</option>
              <option value="clear">clears the field</option>
            </select>
          </label>
          {job.entity !== "product_finishes" && (
            <label>
              Rows that match nothing{" "}
              <select className="input" value={options.unknown} onChange={(e) => setOptions({ ...options, unknown: e.target.value as ImportOptions["unknown"] })}>
                <option value="create">are created as new drafts</option>
                <option value="skip">are skipped</option>
              </select>
            </label>
          )}
          {job.entity === "product_finishes" && (
            <p className={admin.muted}>Each product in the file gets exactly the finishes listed for it, in the file&apos;s order. Products not in the file are left alone.</p>
          )}
        </fieldset>
        {editable && (
          <div className={styles.actions}>
            <label>
              Save this mapping as{" "}
              <input className="input" value={presetName} placeholder="optional name" onChange={(e) => setPresetName(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primary" disabled={progress !== null} onClick={() => void check()}>
              {job.status === "staged" ? "Check the rows again" : "Check the rows"}
            </button>
            {job.status === "staging" && counts.new === undefined && (
              <button type="button" className="btn btn-secondary" disabled={progress !== null} onClick={() => void continueChecking()}>
                Continue checking
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── 2. what would change ── */}
      {["staged", "applying", "applied", "published", "discarded"].includes(job.status) && (
        <section className={styles.step} aria-labelledby="step-check">
          <h2 id="step-check">2. What it changes</h2>
          <p className={styles.counts}>
            {Object.entries(OUTCOME_LABEL).map(([key, label]) => (
              <span key={key} className={key === "error" && counts.error ? styles.bad : undefined}>
                <strong>{(counts[key] ?? 0).toLocaleString("en")}</strong> {label.toLowerCase()}
              </span>
            ))}
          </p>
          <ImportPreview jobId={job.id} />
        </section>
      )}

      {/* ── 3. apply, publish, discard ── */}
      {(job.status === "staged" || job.status === "applying") && (
        <section className={styles.step} aria-labelledby="step-apply">
          <h2 id="step-apply">3. Apply as drafts</h2>
          <p>
            {plural(toApply, "row", "rows")} will be saved as drafts: only the mapped columns change. Rows with errors
            are left out; fix them in the file and import it again, or apply the rest now.
          </p>
          <button type="button" className={`btn btn-primary ${styles.fit}`} disabled={progress !== null || toApply === 0} onClick={() => void apply()}>
            {job.status === "applying" ? "Continue applying" : `Apply ${plural(toApply, "change", "changes")}`}
          </button>
        </section>
      )}
      {job.status === "applied" && (
        <section className={styles.step} aria-labelledby="step-publish">
          <h2 id="step-publish">3. Publish or discard</h2>
          <p>
            Applied as drafts. Nothing is live yet.{" "}
            {(job.entity === "products" || job.entity === "product_finishes") && (
              <Link href={`/admin/products?state=${encodeURIComponent(JSON.stringify({ toolbar: { importJob: job.id } }))}`}>
                See the {plural(job.tagged, "product", "products")} in the grid
              </Link>
            )}
          </p>
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" disabled={progress !== null} onClick={() => void publish()}>
              Publish everything from this import
            </button>
            <button type="button" className="btn btn-secondary" disabled={progress !== null} onClick={() => void discard()}>
              Discard this import&apos;s drafts
            </button>
          </div>
        </section>
      )}
      {job.status === "published" && <p className={admin.message}>Published. The site shows everything this import changed.</p>}
      {job.status === "discarded" && <p className={admin.message}>Discarded. Its drafts were removed and the rows it changed went back to their live versions.</p>}
    </div>
  );
}
