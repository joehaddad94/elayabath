"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FIELDS, IDENTITIES, type Entity, type ImportOptions } from "@/lib/admin/import-fields";
import { listLink } from "@/lib/admin/links";
import admin from "../../../admin.module.css";
import styles from "../imports.module.css";
import { applyNext, configureImport, stageNext, syncNext } from "../actions";
import { useConfirm } from "../../ConfirmDialog";
import { useUnsavedGuard } from "../../useUnsavedGuard";
import { ImportPreview } from "./ImportPreview";

interface JobView {
  id: string;
  entity: Entity;
  status: string;
  counts: Record<string, number>;
  headers: string[];
  columns: Record<string, string>;
  grouped: boolean;
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
 * One import: the rows are checked as soon as the file is in, the page shows
 * what would change, and Apply saves it and puts it on the site. The columns
 * are mapped from the file's headers; they can be changed, which checks the
 * rows again.
 *
 * Checking and applying each run as a loop of short requests from here,
 * with progress shown, so no request runs long however big the file is.
 * Leaving the page stops the loop; coming back continues it.
 */
export function ImportJob({ job, sample }: { job: JobView; sample: string[][] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [columns, setColumns] = useState(job.columns);
  const [options, setOptions] = useState(job.options);
  const [showColumns, setShowColumns] = useState(job.status === "uploaded");
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(job.error ? { text: job.error, error: true } : null);

  // A running check or apply stops if the page is left; it can be
  // continued later, but say so first.
  useUnsavedGuard(progress !== null, "Leaving stops this where it is. You can continue it later from this page.");

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
    const saved = await configureImport({ id: job.id, columns, options });
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

  // A new import is checked straight away, and a check left half done
  // carries on when the page is opened again.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || job.status !== "staging") return;
    started.current = true;
    void continueChecking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const putLive = async () => {
    const total = job.entity === "products" || job.entity === "product_finishes" ? Math.max(job.tagged, toApply) : toApply;
    return loop("Updating the site", async () => syncNext({ id: job.id }), total);
  };

  const apply = async () => {
    const go = await confirm({
      title: `Apply ${plural(toApply, "change", "changes")}?`,
      body: "They are saved and the site shows them straight away. New rows start hidden.",
      confirmLabel: "Apply",
    });
    if (!go) return;
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
    const live = ok && (await putLive());
    if (live && refused) {
      setNotice({
        text: `${plural(refused, "row was", "rows were")} left alone because someone changed them after the check. They are listed as errors.`,
        error: true,
      });
    }
    router.refresh();
  };

  const finish = async () => {
    await putLive();
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

      {/* ── columns and rules, open only when they need attention ── */}
      <section className={styles.step} aria-labelledby="step-map">
        <h2 id="step-map">Columns</h2>
        {job.status === "uploaded" && (
          <p>Choose which column holds what: at least the one that finds each row. Then check the rows.</p>
        )}
        {!showColumns && (
          <p className={admin.muted}>
            {Object.keys(columns).length} of {job.headers.length} columns are used, matched from their headers.{" "}
            <button type="button" className={admin.linkButton} onClick={() => setShowColumns(true)}>
              {editable ? "Change" : "Show"}
            </button>
          </p>
        )}
        {showColumns && !editable && <p className={admin.muted}>{job.grouped ? "The rows have been grouped per product; start a new import to map them differently." : "Fixed once applied; start a new import to change them."}</p>}
        {showColumns && (<>
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
                <option value="create">are created, hidden</option>
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
            <button type="button" className="btn btn-primary" disabled={progress !== null} onClick={() => void check()}>
              {job.status === "uploaded" ? "Check the rows" : "Check the rows again"}
            </button>
          </div>
        )}
        </>)}
      </section>

      {/* ── what would change ── */}
      {["staged", "applying", "applied", "published", "discarded"].includes(job.status) && (
        <section className={styles.step} aria-labelledby="step-check">
          <h2 id="step-check">What it changes</h2>
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

      {/* ── apply ── */}
      {(job.status === "staged" || job.status === "applying") && (
        <section className={styles.step} aria-labelledby="step-apply">
          <h2 id="step-apply">Apply</h2>
          <p>
            {plural(toApply, "row", "rows")} will be saved and shown on the site straight away; only the mapped
            columns change, and new rows start hidden. Rows with errors are left out: fix them in the file and import
            it again, or apply the rest now.
          </p>
          <button type="button" className={`btn btn-primary ${styles.fit}`} disabled={progress !== null || toApply === 0} onClick={() => void apply()}>
            {job.status === "applying" ? "Continue applying" : `Apply ${plural(toApply, "change", "changes")}`}
          </button>
        </section>
      )}
      {job.status === "applied" && (
        <section className={styles.step} aria-labelledby="step-live">
          <h2 id="step-live">Not on the site yet</h2>
          <p>Applied, but the site hasn&apos;t caught up with all of it yet.</p>
          <button type="button" className={`btn btn-primary ${styles.fit}`} disabled={progress !== null} onClick={() => void finish()}>
            Update the site
          </button>
        </section>
      )}
      {job.status === "published" && (
        <p className={admin.message}>
          Applied. The site shows everything this import changed.{" "}
          {(job.entity === "products" || job.entity === "product_finishes") && (counts.new ?? 0) > 0 && (
            <Link href={listLink({ status: "hidden" })}>
              New products start hidden: see the hidden products
            </Link>
          )}
        </p>
      )}
      {job.status === "discarded" && <p className={admin.message}>Discarded. Its drafts were removed and the rows it changed went back to their live versions.</p>}
    </div>
  );
}
