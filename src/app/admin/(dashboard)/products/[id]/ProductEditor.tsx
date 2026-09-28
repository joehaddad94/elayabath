"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { productForm, slugFromSku, type ProductForm } from "@/lib/admin/product-schema";
import admin from "../../../admin.module.css";
import { deleteDraftProduct, publishProduct, restoreVersion, saveProduct } from "./actions";
import styles from "./editor.module.css";
import { useConfirm } from "../../ConfirmDialog";
import { useUnsavedGuard } from "../../useUnsavedGuard";
import { FinishPicker } from "./FinishPicker";
import { History, type Comparable, type Revision } from "./History";
import { Datasheet, Gallery } from "./Media";

export interface FinishOption {
  id: string;
  slug: string;
  code: string;
  name: string;
  family: string;
  swatchUrl: string | null;
  retired: boolean;
  sharedCode: boolean;
}

export interface EditorProduct {
  id: string;
  version: number;
  publishedVersion: number | null;
  updatedAt: string;
  updatedBy: string | null;
  live: { slug: string; status: string } | null;
  form: Omit<ProductForm, "dimensions" | "type_id" | "status" | "datasheet_path"> & {
    dimensions: string;
    type_id: string | null;
    status: "draft" | "active" | "discontinued";
    datasheet_path: string | null;
  };
}

interface Option {
  id: string;
  name: string;
}

/** The form as the inputs hold it: features as lines of text. */
type FormState = Omit<EditorProduct["form"], "features"> & { featuresText: string };

const toState = (form: EditorProduct["form"]): FormState => {
  const { features, ...rest } = form;
  return { ...rest, featuresText: features.join("\n") };
};

const toPayload = ({ featuresText, ...rest }: FormState): ProductForm => ({
  ...rest,
  features: featuresText.split("\n"),
});

// Elaya works in Qatar time. Fixing the zone also means the server's render
// and the browser's agree, wherever the server runs.
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qatar" });

/**
 * One product, every field, saved as a draft.
 *
 * Nothing here touches the site. Save writes the working copy (fields and
 * finishes together, version-checked); Publish then puts that saved copy
 * live. If anything is unsaved when Publish is pressed, it is saved first,
 * so what goes live is what is on screen.
 *
 * Validation runs here with the same schema the server enforces, so most
 * mistakes are caught before a round trip; the server still checks
 * everything, since the browser is not trusted.
 */
export function ProductEditor({
  product,
  me,
  created,
  categories,
  types,
  library,
  revisions,
}: {
  product: EditorProduct;
  me: string;
  created: boolean;
  categories: Array<Option & { slug: string; draft: boolean }>;
  types: Array<Option & { slug: string; categoryId: string }>;
  library: FinishOption[];
  revisions: Revision[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const ids = useId();
  const [form, setForm] = useState<FormState>(() => toState(product.form));
  const [base, setBase] = useState<FormState>(() => toState(product.form));
  const [version, setVersion] = useState(product.version);
  const [publishedVersion, setPublishedVersion] = useState(product.publishedVersion);
  const [live, setLive] = useState(product.live);
  const [saved, setSaved] = useState({ at: product.updatedAt, by: product.updatedBy });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(
    created ? { text: "Created as a draft. Fill in the rest, then publish when it's ready." } : null,
  );
  const [conflict, setConflict] = useState<{ by: string | null; at: string; version: number } | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | "delete" | "restore" | null>(null);
  // Set when the server's copy has been asked for, with what to say once it
  // arrives.
  const [reloading, setReloading] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "history">("edit");

  // The server sends this product again whenever the page refreshes: after a
  // publish (which refreshes the route) or when "Load their version" asks
  // for it. What is on screen is kept unless the server has a newer version
  // and either it was asked for or nothing here is unsaved.
  const [received, setReceived] = useState(product);
  if (product !== received) {
    setReceived(product);
    const unsavedHere = JSON.stringify(form) !== JSON.stringify(base);
    if (product.version !== version && (reloading !== null || !unsavedHere)) {
      setForm(toState(product.form));
      setBase(toState(product.form));
      setVersion(product.version);
      setPublishedVersion(product.publishedVersion);
      setLive(product.live);
      setSaved({ at: product.updatedAt, by: product.updatedBy });
      setConflict(null);
      setErrors({});
      setNotice(reloading !== null ? { text: reloading } : null);
    }
    setReloading(null);
  }

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(base), [form, base]);
  const unpublished = publishedVersion === null || version !== publishedVersion;
  const categoryTypes = types.filter((t) => t.categoryId === form.category_id);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key === "featuresText" ? "features" : (key as string)];
      return next;
    });
  };

  /** Saves the form. `over` is the version being replaced: normally the one
   *  loaded, or, after a conflict, the other person's that was shown. */
  const save = async (over = version): Promise<boolean> => {
    const payload = toPayload(form);
    const check = productForm.safeParse(payload);
    if (!check.success) {
      const fields: Record<string, string> = {};
      for (const issue of check.error.issues) fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      setNotice({ text: "Some fields need attention.", error: true });
      return false;
    }
    setBusy("save");
    setNotice(null);
    const result = await saveProduct({ id: product.id, version: over, form: payload });
    setBusy(null);
    if (result.ok) {
      setVersion(result.version);
      setPublishedVersion(result.publishedVersion);
      setBase(form);
      setSaved({ at: result.updatedAt, by: me });
      setConflict(null);
      setErrors({});
      setNotice({ text: result.message });
      return true;
    }
    if ("conflict" in result) {
      setConflict(result.conflict);
      setNotice(null);
      return false;
    }
    setErrors(result.fields ?? {});
    setNotice({ text: result.error, error: true });
    return false;
  };

  const publish = async () => {
    if (dirty && !(await save())) return;
    setBusy("publish");
    setNotice(null);
    const result = await publishProduct({ id: product.id });
    setBusy(null);
    if (!result.ok) {
      setNotice({ text: result.error, error: true });
      return;
    }
    setPublishedVersion(result.version);
    setLive(result.live);
    // A first publish makes a draft live.
    if (form.status === "draft") {
      setForm((f) => ({ ...f, status: "active" }));
      setBase((b) => ({ ...b, status: "active" }));
    }
    setNotice({ text: result.message });
  };

  const restore = async (revision: Revision) => {
    const go = await confirm({
      title: `Restore version ${revision.version}?`,
      body: `It replaces the draft, photos and data sheet included.${dirty ? " Your unsaved changes are lost." : ""} The site is unchanged until you publish.`,
      confirmLabel: "Restore",
      danger: dirty,
    });
    if (!go) return;
    setBusy("restore");
    setNotice(null);
    const result = await restoreVersion({ id: product.id, revisionId: revision.id, version });
    setBusy(null);
    if (!result.ok) {
      setNotice({ text: result.error, error: true });
      return;
    }
    setReloading(`Version ${revision.version} is restored as a draft. Check it, then publish to put it live.`);
    setTab("edit");
    router.refresh();
  };

  // What is on screen, in the shape a published version is compared in.
  const finishBySlug = useMemo(() => new Map(library.map((f) => [f.slug, f.name])), [library]);
  const finishName = useCallback((slug: string) => finishBySlug.get(slug) ?? slug, [finishBySlug]);
  const current = useMemo<Comparable>(() => {
    const finishById = new Map(library.map((f) => [f.id, f.name]));
    return {
      name: form.name.trim(),
      sku: form.sku.trim(),
      slug: form.slug.trim(),
      category: categories.find((c) => c.id === form.category_id)?.name ?? "",
      type: types.find((t) => t.id === form.type_id)?.name ?? "Not set",
      description: form.description.trim(),
      dimensions: form.dimensions.trim(),
      features: form.featuresText.split("\n").map((f) => f.trim()).filter(Boolean),
      finishes: form.finishes.map((id) => finishById.get(id) ?? id),
      photos: form.images.map((i) => i.path),
      alts: form.images.map((i) => i.alt.trim()),
      datasheet: form.datasheet_path,
      status: form.status === "discontinued" ? "Discontinued" : form.status === "draft" ? "Draft" : "Live",
    };
  }, [form, categories, types, library]);

  const remove = async () => {
    const go = await confirm({
      title: `Delete ${form.sku}?`,
      body: "It has never been published, so nothing on the site links to it. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!go) return;
    setBusy("delete");
    const result = await deleteDraftProduct({ id: product.id });
    setBusy(null);
    setNotice({ text: result.error, error: true });
  };

  // Ctrl+S or Cmd+S saves; the latest `save` is kept in a ref so the listener
  // is added once.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Leaving, reloading or following a link with unsaved changes asks first.
  useUnsavedGuard(dirty);

  const checks = [
    { label: "Photograph", ok: form.images.length > 0 },
    { label: "Product type", ok: form.type_id !== null },
    { label: "Dimensions", ok: form.dimensions.trim() !== "" },
    { label: "Description", ok: form.description.trim() !== "" },
    { label: "Data sheet", ok: form.datasheet_path !== null },
    { label: "At least one finish", ok: form.finishes.length > 0 },
  ];
  const score = checks.filter((c) => c.ok).length;

  const statusLabel =
    publishedVersion === null ? "Draft" : form.status === "discontinued" ? "Discontinued" : "Live";

  const field = (key: string) => ({
    id: `${ids}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${ids}-${key}-error` : undefined,
  });
  const error = (key: string) =>
    errors[key] ? (
      <span id={`${ids}-${key}-error`} className={styles.error}>
        {errors[key]}
      </span>
    ) : null;

  return (
    <form
      className={styles.editor}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <header className={styles.head}>
        <div>
          <h1>{form.name || "Untitled"}</h1>
          <p className={styles.badges}>
            <span className={`${admin.badge} ${statusLabel === "Live" ? "" : admin.badgeWarn}`}>{statusLabel}</span>
            {(dirty || unpublished) && (
              <span className={`${admin.badge} ${admin.badgeWarn}`}>{dirty ? "Unsaved changes" : "Unpublished changes"}</span>
            )}
            {live && (
              <Link href={`/product/${live.slug}`} target="_blank" className={admin.linkButton}>
                View on site
              </Link>
            )}
          </p>
        </div>
      </header>

      {conflict && (
        <div className={`${admin.message} ${admin.messageError} ${styles.conflict}`} role="alert">
          <p>
            <strong>{conflict.by ?? "Someone else"}</strong> saved this product at {when(conflict.at)}, while you
            were editing it. Your changes are not saved yet.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setReloading("Their version is loaded. Your changes were discarded.");
                router.refresh();
              }}
            >
              Load their version
            </button>
            <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void save(conflict.version)}>
              Keep mine and overwrite
            </button>
          </div>
        </div>
      )}

      <div className={styles.columns}>
        <div className={styles.main}>
          <div className={styles.tabs} role="tablist" aria-label="Product">
            <button type="button" role="tab" aria-selected={tab === "edit"} className={styles.tab} onClick={() => setTab("edit")}>
              Details
            </button>
            <button type="button" role="tab" aria-selected={tab === "history"} className={styles.tab} onClick={() => setTab("history")}>
              History ({revisions.length})
            </button>
          </div>
          {tab === "history" ? (
            <History
              revisions={revisions}
              publishedVersion={publishedVersion}
              current={current}
              finishName={finishName}
              busy={busy !== null}
              onRestore={(r) => void restore(r)}
            />
          ) : (
          <>
          <fieldset className={styles.section}>
            <legend>Basics</legend>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label htmlFor={`${ids}-name`} className={styles.label}>Name</label>
                <input {...field("name")} className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
                {error("name")}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${ids}-sku`} className={styles.label}>Item code</label>
                <input {...field("sku")} className="input" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
                {error("sku")}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${ids}-category_id`} className={styles.label}>Category</label>
                <select
                  {...field("category_id")}
                  className="input"
                  value={form.category_id}
                  onChange={(e) => {
                    const category = e.target.value;
                    const keepType = types.some((t) => t.id === form.type_id && t.categoryId === category);
                    setForm((f) => ({ ...f, category_id: category, type_id: keepType ? f.type_id : null }));
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.draft ? `${c.name} (draft)` : c.name}</option>
                  ))}
                </select>
                {error("category_id")}
                {categories.find((c) => c.id === form.category_id)?.draft && (
                  <span className={styles.hint}>
                    This category is a draft: the product can go live, but it has no category page or menu entry until the
                    category is published.
                  </span>
                )}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${ids}-type_id`} className={styles.label}>Type</label>
                <select {...field("type_id")} className="input" value={form.type_id ?? ""} onChange={(e) => set("type_id", e.target.value || null)}>
                  <option value="">Not set</option>
                  {categoryTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {error("type_id")}
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${ids}-slug`} className={styles.label}>Web address</label>
              <div className={styles.slug}>
                <span className={styles.prefix}>/product/</span>
                <input {...field("slug")} className="input" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={() => set("slug", slugFromSku(form.sku))} disabled={slugFromSku(form.sku) === form.slug}>
                  Use the item code
                </button>
              </div>
              {error("slug")}
              {live && live.slug !== form.slug && (
                <span className={styles.hint}>When published, /product/{live.slug} will redirect here, so old links keep working.</span>
              )}
            </div>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Details</legend>
            <div className={styles.field}>
              <label htmlFor={`${ids}-description`} className={styles.label}>Description</label>
              <textarea {...field("description")} className="input" rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
              {error("description")}
            </div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label htmlFor={`${ids}-dimensions`} className={styles.label}>Dimensions</label>
                <input {...field("dimensions")} className="input" value={form.dimensions} placeholder="e.g. 600 x 450 x 180 mm" onChange={(e) => set("dimensions", e.target.value)} />
                {error("dimensions")}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${ids}-features`} className={styles.label}>Features, one per line</label>
                <textarea {...field("features")} className="input" rows={4} value={form.featuresText} onChange={(e) => set("featuresText", e.target.value)} />
                {error("features")}
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Photographs</legend>
            <Gallery
              productId={product.id}
              images={form.images}
              defaultAlt={[form.name, form.dimensions.trim()].filter(Boolean).join(", ")}
              onChange={(update) => {
                setForm((f) => ({ ...f, images: update(f.images) }));
                setErrors((current) => {
                  const next = { ...current };
                  delete next.images;
                  return next;
                });
              }}
            />
            {error("images")}
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Data sheet</legend>
            <Datasheet productId={product.id} path={form.datasheet_path} onChange={(path) => set("datasheet_path", path)} />
            {error("datasheet_path")}
          </fieldset>

          <fieldset className={styles.section}>
            <legend>Finishes</legend>
            <FinishPicker library={library} value={form.finishes} onChange={(next) => set("finishes", next)} />
            {error("finishes")}
          </fieldset>
          </>
          )}
        </div>

        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2>Publishing</h2>
            {publishedVersion === null ? (
              <p className={styles.hint}>Not on the site yet. Publishing makes it live.</p>
            ) : (
              <div className={styles.field} role="radiogroup" aria-label="Status">
                <label className={styles.check}>
                  <input type="radio" name="status" checked={form.status === "active"} onChange={() => set("status", "active")} />
                  Live
                </label>
                <label className={styles.check}>
                  <input type="radio" name="status" checked={form.status === "discontinued"} onChange={() => set("status", "discontinued")} />
                  Discontinued: hidden from listings, page kept
                </label>
              </div>
            )}
            <label className={styles.check}>
              <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />
              Featured on the homepage
            </label>

            <div className={styles.buttons}>
              <button type="submit" className="btn btn-secondary" disabled={busy !== null || !dirty}>
                {busy === "save" ? "Saving" : "Save draft"}
              </button>
              <button type="button" className="btn btn-primary" disabled={busy !== null || (!dirty && !unpublished)} onClick={() => void publish()}>
                {busy === "publish" ? "Publishing" : dirty ? "Save and publish" : "Publish"}
              </button>
            </div>
            {dirty ? (
              <p className={styles.hint}>Preview shows the saved draft; save first to see these changes.</p>
            ) : (
              <a href={`/admin/preview?product=${product.id}`} target="_blank" rel="noreferrer" className={admin.linkButton}>
                Preview the saved draft on the site
              </a>
            )}
            {notice && (
              <p className={`${admin.message} ${notice.error ? admin.messageError : ""}`} role={notice.error ? "alert" : "status"}>
                {notice.text}
              </p>
            )}
            <p className={styles.meta}>
              Last saved {when(saved.at)}
              {saved.by ? ` by ${saved.by}` : ""}.
              {!dirty && !unpublished && " The site shows this version."}
            </p>
          </section>

          <section className={styles.panel}>
            <h2>
              Completeness <span className={styles.score}>{score}/6</span>
            </h2>
            <ul className={styles.checks}>
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? styles.ok : styles.missing}>
                  <span aria-hidden="true">{c.ok ? "✓" : "○"}</span> {c.label}
                  <span className="sr-only">{c.ok ? ", done" : ", missing"}</span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>Gaps never block publishing; they show on the Needs attention list.</p>
          </section>

          {publishedVersion === null && (
            <section className={styles.panel}>
              <h2>Delete</h2>
              <p className={styles.hint}>Only a product that has never been published can be deleted.</p>
              <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void remove()}>
                {busy === "delete" ? "Deleting" : "Delete this draft"}
              </button>
            </section>
          )}
        </aside>
      </div>
    </form>
  );
}
