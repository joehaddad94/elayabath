"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { FINISH_FAMILIES, finishForm, type FinishForm } from "@/lib/admin/catalogue-schema";
import { MAX_SWATCH_EDGE, preparePhoto, swatchFolder } from "@/lib/admin/media";
import { browserClient } from "@/lib/supabase/browser";
import { storageUrl } from "@/lib/supabase/config";
import { FINISH_FAMILY_NAMES } from "@/lib/types";
import admin from "../../admin.module.css";
import editor from "../products/[id]/editor.module.css";
import styles from "./finishes.module.css";
import { createFinish, deleteFinish, publishFinishNow, saveFinish, type NewFinishState } from "./actions";

export interface LibraryFinish {
  id: string;
  version: number;
  publishedVersion: number | null;
  swatchUrl: string | null;
  products: number;
  liveProducts: number;
  sharedCode: boolean;
  form: FinishForm & { family: (typeof FINISH_FAMILIES)[number]; status: "active" | "retired" };
}

const stateOf = (f: LibraryFinish) =>
  f.publishedVersion === null ? "Not published" : f.version !== f.publishedVersion ? "Unpublished changes" : null;

/**
 * The library on the left, filterable; the chosen finish's editor on the
 * right. Saved as a draft and published like everything else; the swatch is
 * reduced in the browser and uploaded straight to Storage.
 */
export function FinishLibrary({ finishes, selected }: { finishes: LibraryFinish[]; selected?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [only, setOnly] = useState<"" | "shared" | "unpublished" | "retired" | "unused">("");
  const [chosenId, setChosenId] = useState<string | null>(selected ?? null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return finishes.filter(
      (f) =>
        (q === "" || f.form.name.toLowerCase().includes(q) || f.form.code.toLowerCase().includes(q)) &&
        (family === "" || f.form.family === family) &&
        (only === "" ||
          (only === "shared" && f.sharedCode) ||
          (only === "unpublished" && stateOf(f) !== null) ||
          (only === "retired" && f.form.status === "retired") ||
          (only === "unused" && f.products === 0)),
    );
  }, [finishes, query, family, only]);
  const chosen = finishes.find((f) => f.id === chosenId) ?? null;

  const choose = (id: string) => {
    setChosenId(id);
    router.replace(`/admin/finishes?finish=${id}`, { scroll: false });
  };

  return (
    <div className={styles.layout}>
      <div className={styles.list}>
        <div className={styles.filters}>
          <input className="input" type="search" placeholder="Name or code" aria-label="Search finishes" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input" aria-label="Material" value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">All materials</option>
            {FINISH_FAMILIES.map((f) => (
              <option key={f} value={f}>{FINISH_FAMILY_NAMES[f]}</option>
            ))}
          </select>
          <select className="input" aria-label="Show only" value={only} onChange={(e) => setOnly(e.target.value as typeof only)}>
            <option value="">All finishes</option>
            <option value="shared">Codes shared with another finish</option>
            <option value="unpublished">Unpublished</option>
            <option value="unused">Used by no product</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <p className={admin.muted} aria-live="polite">
          {shown.length} of {finishes.length}
        </p>
        <ul className={styles.rows}>
          {shown.map((f) => (
            <li key={f.id}>
              <button type="button" className={`${styles.row} ${f.id === chosenId ? styles.chosen : ""}`} aria-pressed={f.id === chosenId} onClick={() => choose(f.id)}>
                {f.swatchUrl ? (
                  <Image src={f.swatchUrl} alt="" width={32} height={32} className={styles.swatch} />
                ) : (
                  <span className={styles.swatch} aria-hidden="true" />
                )}
                <span className={styles.name}>
                  {f.form.name}
                  <span className={admin.muted}>
                    {f.form.code} · {FINISH_FAMILY_NAMES[f.form.family]} · {f.products} product{f.products === 1 ? "" : "s"}
                  </span>
                </span>
                <span className={styles.flags}>
                  {f.sharedCode && <span className={`${admin.badge} ${admin.badgeWarn}`}>Shared code</span>}
                  {f.form.status === "retired" && <span className={admin.badge}>Retired</span>}
                  {stateOf(f) && <span className={`${admin.badge} ${admin.badgeWarn}`}>{stateOf(f)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.side}>
        {chosen ? (
          <FinishEditor key={chosen.id} finish={chosen} onDeleted={() => setChosenId(null)} />
        ) : (
          <p className={admin.muted}>Choose a finish to edit it.</p>
        )}
        <NewFinish onCreated={choose} />
      </div>
    </div>
  );
}

function FinishEditor({ finish, onDeleted }: { finish: LibraryFinish; onDeleted: () => void }) {
  const router = useRouter();
  const ids = useId();
  const upload = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(finish.form);
  const [base, setBase] = useState(finish.form);
  const [version, setVersion] = useState(finish.version);
  const [publishedVersion, setPublishedVersion] = useState(finish.publishedVersion);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; error?: boolean; reload?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [reloading, setReloading] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);

  // The page refreshes after every save and publish. Take the server's copy
  // only when it is newer and was asked for, or nothing here is unsaved.
  const [received, setReceived] = useState(finish);
  if (finish !== received) {
    setReceived(finish);
    if (finish.version !== version && (reloading !== null || !dirty)) {
      setForm(finish.form);
      setBase(finish.form);
      setVersion(finish.version);
      setPublishedVersion(finish.publishedVersion);
      setErrors({});
      setNotice(reloading !== null ? { text: reloading } : null);
    }
    setReloading(null);
  }

  const unpublished = publishedVersion === null || version !== publishedVersion;
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (): Promise<boolean> => {
    const check = finishForm.safeParse(form);
    if (!check.success) {
      const fields: Record<string, string> = {};
      for (const issue of check.error.issues) fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      return false;
    }
    setBusy("save");
    setNotice(null);
    const result = await saveFinish({ id: finish.id, version, form });
    setBusy(null);
    if (!result.ok) {
      setErrors(result.fields ?? {});
      setNotice({ text: result.error, error: true, reload: result.conflict });
      return false;
    }
    setVersion(result.version);
    setBase(form);
    setErrors({});
    setNotice({ text: result.message });
    return true;
  };

  const publish = async () => {
    if (dirty && !(await save())) return;
    setBusy("publish");
    setNotice(null);
    const result = await publishFinishNow({ id: finish.id });
    setBusy(null);
    if (result.ok) setPublishedVersion(result.version ?? null);
    setNotice(result.ok ? { text: result.message ?? "Published." } : { text: result.error ?? "It couldn't be published.", error: true });
  };

  const uploadSwatch = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    setNotice(null);
    try {
      const photo = await preparePhoto(file, MAX_SWATCH_EDGE);
      const path = `${swatchFolder(finish.id)}${crypto.randomUUID()}.${photo.extension}`;
      const { error } = await browserClient()
        .storage.from("swatches")
        .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(`It couldn't be uploaded: ${error.message}`);
      set("swatch_path", path);
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "It couldn't be uploaded.", error: true });
    }
    setBusy(null);
  };

  // A retired finish's products keep showing it; say how many before retiring.
  const retiring = form.status === "retired" && base.status !== "retired" && finish.liveProducts > 0;
  const field = (key: string) => ({ id: `${ids}-${key}`, "aria-invalid": errors[key] ? true : undefined });
  const error = (key: string) => (errors[key] ? <span className={editor.error}>{errors[key]}</span> : null);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  return (
    <section className={editor.panel} aria-labelledby={`${ids}-title`}>
      <h2 id={`${ids}-title`}>
        {form.name || "Untitled finish"}
        <span className={admin.muted}>{finish.products} products, {finish.liveProducts} live</span>
      </h2>
      {finish.sharedCode && (
        <p className={`${admin.message} ${admin.messageError}`}>
          Another finish has the code {finish.form.code}, so a quote naming it can&apos;t say which finish it means.
        </p>
      )}
      <div className={styles.swatchRow}>
        {form.swatch_path ? (
          <Image src={storageUrl("swatches", form.swatch_path)} alt="" width={72} height={72} className={styles.bigSwatch} />
        ) : (
          <span className={styles.bigSwatch} aria-hidden="true" />
        )}
        <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => upload.current?.click()}>
          {busy === "upload" ? "Uploading" : form.swatch_path ? "Replace swatch" : "Upload a swatch"}
        </button>
        <input ref={upload} type="file" accept="image/*" hidden aria-label="Swatch image" onChange={(e) => { void uploadSwatch(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <div className={editor.field}>
        <label htmlFor={`${ids}-name`} className={editor.label}>Name</label>
        <input {...field("name")} className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
        {error("name")}
      </div>
      <div className={editor.grid2}>
        <div className={editor.field}>
          <label htmlFor={`${ids}-code`} className={editor.label}>Code</label>
          <input {...field("code")} className="input" value={form.code} onChange={(e) => set("code", e.target.value)} />
          {error("code")}
        </div>
        <div className={editor.field}>
          <label htmlFor={`${ids}-family`} className={editor.label}>Material</label>
          <select {...field("family")} className="input" value={form.family} onChange={(e) => set("family", e.target.value as typeof form.family)}>
            {FINISH_FAMILIES.map((f) => (
              <option key={f} value={f}>{FINISH_FAMILY_NAMES[f]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className={editor.field}>
        <label htmlFor={`${ids}-slug`} className={editor.label}>Web address</label>
        <input {...field("slug")} className="input" value={form.slug} readOnly={publishedVersion !== null} onChange={(e) => set("slug", e.target.value)} />
        {error("slug")}
        {publishedVersion !== null && <span className={editor.hint}>Fixed once published: the site&apos;s colour filters link to it.</span>}
      </div>
      <label className={editor.check}>
        <input type="checkbox" checked={form.status === "retired"} onChange={(e) => set("status", e.target.checked ? "retired" : "active")} />
        Retired: hidden from the picker and the site&apos;s filters
      </label>
      {retiring && (
        <p className={editor.hint}>
          Its {finish.liveProducts} live products keep showing it. Remove it from them to take it off their pages.
        </p>
      )}
      <div className={editor.buttons}>
        <button type="button" className="btn btn-secondary" disabled={busy !== null || !dirty} onClick={() => void save()}>
          {busy === "save" ? "Saving" : "Save draft"}
        </button>
        <button type="button" className="btn btn-primary" disabled={busy !== null || (!dirty && !unpublished)} onClick={() => void publish()}>
          {busy === "publish" ? "Publishing" : dirty ? "Save and publish" : "Publish"}
        </button>
      </div>
      {notice && (
        <div className={`${admin.message} ${notice.error ? admin.messageError : ""}`} role={notice.error ? "alert" : "status"}>
          {notice.text}
          {notice.reload && (
            <>
              {" "}
              <button
                type="button"
                className={admin.linkButton}
                onClick={() => {
                  setReloading("Their version is loaded. Your changes were discarded.");
                  router.refresh();
                }}
              >
                Load their version
              </button>
            </>
          )}
        </div>
      )}
      {finish.products === 0 && publishedVersion === null && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy !== null}
          onClick={async () => {
            if (!window.confirm(`Delete ${form.name} for good? No product uses it and it has never been published.`)) return;
            setBusy("delete");
            const result = await deleteFinish({ id: finish.id });
            setBusy(null);
            if (result.ok) onDeleted();
            else setNotice({ text: result.error ?? "It couldn't be deleted.", error: true });
          }}
        >
          Delete this finish
        </button>
      )}
    </section>
  );
}

function NewFinish({ onCreated }: { onCreated: (id: string) => void }) {
  const [state, action, pending] = useActionState<NewFinishState, FormData>(createFinish, {});
  const created = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (state.created && state.created !== created.current) {
      created.current = state.created;
      onCreated(state.created);
    }
  }, [state.created, onCreated]);

  return (
    <section className={editor.panel} aria-labelledby="new-finish">
      <h2 id="new-finish">New finish</h2>
      <form action={action} className={styles.newForm} key={state.attempt ?? 0}>
        <label className={editor.label}>
          Name
          <input name="name" className="input" required defaultValue={state.created ? "" : state.values?.name} />
        </label>
        <label className={editor.label}>
          Code
          <input name="code" className="input" required defaultValue={state.created ? "" : state.values?.code} />
        </label>
        <label className={editor.label}>
          Material
          <select name="family" className="input" defaultValue={state.created ? "" : (state.values?.family ?? "")} required>
            <option value="" disabled>Choose</option>
            {FINISH_FAMILIES.map((f) => (
              <option key={f} value={f}>{FINISH_FAMILY_NAMES[f]}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary" disabled={pending}>
          {pending ? "Adding" : "Add to the library"}
        </button>
      </form>
      {state.error && (
        <p className={`${admin.message} ${admin.messageError}`} role="alert">
          {state.error}
          {state.fields && ` ${Object.values(state.fields).join(" ")}`}
        </p>
      )}
      {state.created && (
        <p className={admin.message} role="status">
          Added, unpublished. It goes live when you publish it, or with the first product that uses it.
          {state.note && ` ${state.note}`}
        </p>
      )}
    </section>
  );
}
