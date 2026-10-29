"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ENTITY_LABEL, type Entity } from "@/lib/admin/import-fields";
import { browserClient } from "@/lib/supabase/browser";
import styles from "../../admin.module.css";
import { startImport } from "./actions";

const MAX_BYTES = 50 * 1024 ** 2;

/** From the extension, not the browser: Windows often calls a CSV an Excel
 *  file, which the imports bucket would refuse. */
const TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
};

/**
 * Choose what the file holds, pick the file: it goes straight to the private
 * imports bucket from the browser, then the server reads it once and the
 * import opens, already checking its rows.
 */
export function NewImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState<Entity>("products");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.(xlsx|csv|tsv|txt)$/i.test(file.name)) return setError("Use an Excel (.xlsx), CSV or TSV file.");
    if (file.size > MAX_BYTES) return setError("The file is over 50 MB. Split it in two.");
    setBusy("Uploading");
    const path = `jobs/${crypto.randomUUID()}/${file.name.replace(/[^\w.\- ]+/g, "_")}`;
    const { error: uploadError } = await browserClient().storage.from("imports").upload(path, file, {
      contentType: TYPES[file.name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      setBusy(null);
      return setError(`It couldn't be uploaded: ${uploadError.message}`);
    }
    setBusy("Reading the file");
    const result = await startImport({ entity, path, fileName: file.name });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    router.push(`/admin/imports/${result.id}`);
  };

  return (
    <div className={styles.inline}>
      <div className={styles.field}>
        <label htmlFor="import-entity">The file holds</label>
        <select id="import-entity" className="input" value={entity} onChange={(e) => setEntity(e.target.value as Entity)}>
          {(Object.keys(ENTITY_LABEL) as Entity[]).map((e) => (
            <option key={e} value={e}>{ENTITY_LABEL[e]}</option>
          ))}
        </select>
      </div>
      <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => input.current?.click()}>
        {busy ?? "Choose a file"}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        aria-label="Spreadsheet to import"
        accept=".xlsx,.csv,.tsv,.txt,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span className={styles.muted}>Excel, CSV or TSV. You see what would change before anything does.</span>
      {error && (
        <p className={`${styles.message} ${styles.messageError}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
