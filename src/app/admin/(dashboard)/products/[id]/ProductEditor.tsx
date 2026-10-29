"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon/Icon";
import { productForm, slugFromSku, type ProductForm } from "@/lib/admin/product-schema";
import admin from "../../../admin.module.css";
import { deleteDraftProduct, saveProduct } from "./actions";
import styles from "./editor.module.css";
import { useConfirm } from "../../ConfirmDialog";
import { useUnsavedGuard } from "../../useUnsavedGuard";
import { Spinner } from "../../Spinner";
import { FinishPicker } from "./FinishPicker";
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
  updatedAt: string;
  updatedBy: string | null;
  /** Its page on the site, while it is visible. */
  live: { slug: string } | null;
  /** Never on the site, so nothing links to it and it can be deleted. */
  deletable: boolean;
  form: Omit<ProductForm, "dimensions" | "type_id" | "status" | "datasheet_path"> & {
    dimensions: string;
    type_id: string | null;
    status: "draft" | "active";
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
 * One product, every field. Save writes it (fields and finishes together,
 * version-checked) and puts it live: the site shows it if it is visible and
 * drops it if it is hidden.
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
}: {
  product: EditorProduct;
  me: string;
  created: boolean;
  categories: Array<Option & { slug: string; hidden: boolean }>;
  types: Array<Option & { slug: string; categoryId: string }>;
  library: FinishOption[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const ids = useId();
  const [form, setForm] = useState<FormState>(() => toState(product.form));
  const [base, setBase] = useState<FormState>(() => toState(product.form));
  const [version, setVersion] = useState(product.version);
  const [live, setLive] = useState(product.live);
  const [saved, setSaved] = useState({ at: product.updatedAt, by: product.updatedBy });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(
    created ? { text: "Created, and hidden from the site. Fill in the rest, then choose Visible and save." } : null,
  );
  const [conflict, setConflict] = useState<{ by: string | null; at: string; version: number } | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  // Set when the server's copy has been asked for, with what to say once it
  // arrives.
  const [reloading, setReloading] = useState<string | null>(null);

  // The server sends this product again whenever the page refreshes, as
  // when "Load their version" asks for it. What is on screen is kept unless the server has a newer version
  // and either it was asked for or nothing here is unsaved.
  const [received, setReceived] = useState(product);
  if (product !== received) {
    setReceived(product);
    const unsavedHere = JSON.stringify(form) !== JSON.stringify(base);
    if (product.version !== version && (reloading !== null || !unsavedHere)) {
      setForm(toState(product.form));
      setBase(toState(product.form));
      setVersion(product.version);
      setLive(product.live);
      setSaved({ at: product.updatedAt, by: product.updatedBy });
      setConflict(null);
      setErrors({});
      setNotice(reloading !== null ? { text: reloading } : null);
    }
    setReloading(null);
  }

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(base), [form, base]);
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
      focusField(Object.keys(fields)[0]);
      return false;
    }
    setBusy("save");
    setNotice(null);
    // A save that never answers (the connection dropped) must not leave
    // "Saving" turning; the form keeps its changes for another try.
    const result = await saveProduct({ id: product.id, version: over, form: payload }).catch(() => null);
    setBusy(null);
    if (result === null) {
      setNotice({ text: "That didn't reach the server, so nothing was saved. Check the connection and save again.", error: true });
      return false;
    }
    if (result.ok) {
      setVersion(result.version);
      setLive(result.live);
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
    focusField(Object.keys(result.fields ?? {})[0]);
    return false;
  };

  /** Takes the person to the first field that needs attention. */
  const focusField = (key: string | undefined) => {
    if (!key) return;
    const element = document.getElementById(key === "images" ? "photographs" : `${ids}-${key}`);
    element?.scrollIntoView({ block: "center" });
    element?.focus({ preventScroll: true });
  };

  const remove = async () => {
    const go = await confirm({
      title: `Delete ${form.sku}?`,
      body: "It has never been on the site, so nothing links to it. This can't be undone.",
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
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    saveRef.current = save;
    dirtyRef.current = dirty;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current) void saveRef.current();
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

  // The site's state is the saved one; an unsaved switch shows as a change.
  const statusLabel = base.status === "active" ? "Visible" : "Hidden";
  const noPhoto = form.images.length === 0;

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
            <span className={`${admin.badge} ${statusLabel === "Visible" ? "" : admin.badgeWarn}`}>{statusLabel}</span>
            {dirty && (
              <span className={`${admin.badge} ${admin.badgeWarn}`}>
                {form.status !== base.status ? `Unsaved: will be ${form.status === "active" ? "visible" : "hidden"}` : "Unsaved changes"}
              </span>
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
              {busy === "save" && <Spinner />}
              Keep mine and overwrite
            </button>
          </div>
        </div>
      )}

      <div className={styles.columns}>
        <div className={styles.main}>
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
                    <option key={c.id} value={c.id}>{c.hidden ? `${c.name} (hidden)` : c.name}</option>
                  ))}
                </select>
                {error("category_id")}
                {categories.find((c) => c.id === form.category_id)?.hidden && (
                  <span className={styles.hint}>
                    This category is hidden: the product can be visible, but it has no category page or menu entry until
                    the category is made visible.
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
                <span className={styles.hint}>When saved, /product/{live.slug} will redirect here, so old links keep working.</span>
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

          <fieldset className={styles.section} id="photographs" tabIndex={-1}>
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
        </div>

        <aside className={styles.side}>
          <section className={styles.panel}>
            <h2>On the site</h2>
            <div className={styles.field} role="radiogroup" aria-label="On the site">
              <label className={styles.check}>
                <input type="radio" name="status" checked={form.status === "active"} onChange={() => set("status", "active")} />
                Visible
              </label>
              <label className={styles.check}>
                <input type="radio" name="status" checked={form.status === "draft"} onChange={() => set("status", "draft")} />
                Hidden: not on the site at all
              </label>
            </div>
            {form.status === "active" && noPhoto && (
              <p className={styles.hint}>It has no photograph, so the site will show it without one.</p>
            )}

            <div className={styles.buttons}>
              <button type="submit" className="btn btn-primary" disabled={busy !== null || !dirty}>
                {busy === "save" ? <><Spinner />Saving</> : dirty ? "Save" : "Saved"}
              </button>
              {live && !dirty && (
                <Link href={`/product/${live.slug}`} target="_blank" className="btn btn-secondary">
                  View on site
                </Link>
              )}
            </div>
            <p className={styles.hint}>Saving changes the site straight away.</p>
            {dirty ? (
              <p className={styles.hint}>Preview shows the saved product; save first to see these changes.</p>
            ) : (
              live === null && (
                <a href={`/admin/preview?product=${product.id}`} target="_blank" rel="noreferrer" className={admin.linkButton}>
                  Preview it on the site
                </a>
              )
            )}
            {notice && (
              <p className={`${admin.message} ${notice.error ? admin.messageError : ""}`} role={notice.error ? "alert" : "status"}>
                {notice.text}
              </p>
            )}
            <p className={styles.meta}>
              Last saved {when(saved.at)}
              {saved.by ? ` by ${saved.by}` : ""}.
            </p>
          </section>

          <section className={styles.panel}>
            <h2>
              Completeness <span className={styles.score}>{score}/6</span>
            </h2>
            <ul className={styles.checks}>
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? styles.ok : styles.missing}>
                  <Icon name={c.ok ? "check" : "circle"} size={16} /> {c.label}
                  <span className="sr-only">{c.ok ? ", done" : ", missing"}</span>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>Gaps never block saving; they show on the Needs attention list.</p>
          </section>

          {product.deletable && live === null && (
            <section className={styles.panel}>
              <h2>Delete</h2>
              <p className={styles.hint}>Only a product that has never been on the site can be deleted.</p>
              <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void remove()}>
                {busy === "delete" ? <><Spinner />Deleting</> : "Delete this product"}
              </button>
            </section>
          )}
        </aside>
      </div>

      {/* On a phone the panel above sits below the form, so Save stays in
          reach here while there is something to save. */}
      {dirty && (
        <div className={styles.saveBar}>
          <span>
            {form.status === "active" ? "Visible" : "Hidden"} · unsaved changes
          </span>
          <button type="submit" className="btn btn-primary" disabled={busy !== null}>
            {busy === "save" ? <><Spinner />Saving</> : "Save"}
          </button>
        </div>
      )}
    </form>
  );
}
