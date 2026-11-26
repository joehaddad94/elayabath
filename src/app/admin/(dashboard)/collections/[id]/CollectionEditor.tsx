"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { collectionFolder, collectionForm, slugify, type CollectionForm } from "@/lib/admin/catalogue-schema";
import { MAX_PHOTO_BYTES, formatBytes, preparePhoto } from "@/lib/admin/media";
import { browserClient } from "@/lib/supabase/browser";
import { storageUrl } from "@/lib/supabase/config";
import admin from "../../../admin.module.css";
import editor from "../../products/[id]/editor.module.css";
import { useConfirm } from "../../ConfirmDialog";
import { Spinner } from "../../Spinner";
import { useUnsavedGuard } from "../../useUnsavedGuard";
import { deleteCollection, saveCollection } from "../actions";

interface Product {
  id: string;
  sku: string;
  name: string;
  visible: boolean;
  imageUrl: string | null;
}

type Form = Omit<CollectionForm, "image_path"> & { image_path: string | null };

/**
 * A collection: its name, web address, description and photo, live when
 * saved; and the products in it, each opening its own editor, where a
 * product's collection is chosen.
 */
export function CollectionEditor({
  collection,
  photoUrl,
  fallbackUrl,
  products,
}: {
  collection: { id: string; categoryName: string; categorySlug: string; form: Form };
  photoUrl: string | null;
  fallbackUrl: string | null;
  products: Product[];
}) {
  const ids = useId();
  const confirm = useConfirm();
  const upload = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(collection.form);
  const [base, setBase] = useState<Form>(collection.form);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<"save" | "upload" | "delete" | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  useUnsavedGuard(dirty);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };
  const live = products.some((p) => p.visible);
  const shownPhoto = form.image_path ? (form.image_path === collection.form.image_path ? photoUrl : storageUrl("site-media", form.image_path)) : null;

  const save = async () => {
    const check = collectionForm.safeParse(form);
    if (!check.success) {
      const fields: Record<string, string> = {};
      for (const issue of check.error.issues) fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      setNotice({ text: "Some fields need attention.", error: true });
      return;
    }
    if (form.slug !== base.slug && live) {
      const go = await confirm({
        title: "Change the web address?",
        body: "The collection's page moves to the new address, and links to the old one stop working.",
        confirmLabel: "Change it",
      });
      if (!go) return;
    }
    setBusy("save");
    setNotice(null);
    const result = await saveCollection({ id: collection.id, form }).catch(() => ({
      ok: false as const,
      error: "That didn't reach the server, so nothing changed. Try again.",
    }));
    setBusy(null);
    if (!result.ok) {
      setErrors("fields" in result ? (result.fields ?? {}) : {});
      setNotice({ text: result.error, error: true });
      return;
    }
    setBase(form);
    setErrors({});
    setNotice({ text: live ? result.message : "Saved. It shows on the site once one of its products is visible." });
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    setNotice(null);
    try {
      const photo = await preparePhoto(file);
      if (photo.blob.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} is still over ${formatBytes(MAX_PHOTO_BYTES)} after reducing it.`);
      // Every upload has a new name, so a year's caching is safe.
      const path = `${collectionFolder(collection.id)}${crypto.randomUUID()}.${photo.extension}`;
      const { error } = await browserClient()
        .storage.from("site-media")
        .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(`${file.name} couldn't be uploaded: ${error.message}`);
      set("image_path", path);
      setNotice({ text: "Photo uploaded. Save to put it on the site." });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "It couldn't be uploaded.", error: true });
    }
    setBusy(null);
  };

  const remove = async () => {
    const go = await confirm({
      title: `Delete “${base.name}”?`,
      body: "It has no products, so nothing on the site changes.",
      confirmLabel: "Delete",
    });
    if (!go) return;
    setBusy("delete");
    const result = await deleteCollection({ id: collection.id }).catch(() => ({ ok: false as const, error: "That didn't reach the server. Try again." }));
    // Success redirects; only a refusal comes back.
    setBusy(null);
    setNotice({ text: result.error, error: true });
  };

  const field = (key: string) => ({
    id: `${ids}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${ids}-${key}-error` : undefined,
  });
  const error = (key: string) =>
    errors[key] ? (
      <span id={`${ids}-${key}-error`} className={editor.error}>
        {errors[key]}
      </span>
    ) : null;

  return (
    <div className={editor.editor}>
      <header className={editor.head}>
        <h1>{form.name || "Untitled collection"}</h1>
        <p className={editor.badges}>
          <span className={admin.badge}>{collection.categoryName}</span>
          <span className={`${admin.badge} ${live ? "" : admin.badgeWarn}`}>{live ? "On the site" : "Not on the site"}</span>
          {dirty && <span className={`${admin.badge} ${admin.badgeWarn}`}>Unsaved changes</span>}
          {live && (
            <Link href={`/products/${collection.categorySlug}/${base.slug}`} target="_blank" className={admin.linkButton}>
              View on site
            </Link>
          )}
        </p>
      </header>

      <div className={editor.columns}>
        <form
          className={editor.main}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset className={editor.section}>
            <legend>Details</legend>
            <div className={editor.grid2}>
              <div className={editor.field}>
                <label htmlFor={`${ids}-name`} className={editor.label}>Name</label>
                <input {...field("name")} className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
                {error("name")}
              </div>
              <div className={editor.field}>
                <label htmlFor={`${ids}-slug`} className={editor.label}>Web address</label>
                <div className={editor.slug}>
                  <span className={editor.prefix}>/products/{collection.categorySlug}/</span>
                  <input {...field("slug")} className="input" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!slugify(form.name) || slugify(form.name) === form.slug}
                    onClick={() => set("slug", slugify(form.name))}
                  >
                    Use the name
                  </button>
                </div>
                {error("slug")}
              </div>
            </div>
            <div className={editor.field}>
              <label htmlFor={`${ids}-description`} className={editor.label}>Description, shown at the top of its page</label>
              <textarea
                {...field("description")}
                className="input"
                rows={4}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
              {error("description")}
            </div>
          </fieldset>

          <fieldset className={editor.section}>
            <legend>Photo</legend>
            <p className={editor.hint}>
              Shown on its card and across the top of its page. Without one, the card shows the photo of its first product.
            </p>
            {shownPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- a preview, possibly of a fresh upload
              <img src={shownPhoto} alt="" width={240} height={180} style={{ objectFit: "cover" }} />
            ) : fallbackUrl ? (
              <p className={editor.hint}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a preview of the product photo used instead */}
                <img src={fallbackUrl} alt="" width={120} height={120} style={{ objectFit: "contain" }} />
                <br />
                Using its first product&apos;s photo.
              </p>
            ) : (
              <p className={editor.hint}>No photo, and none of its visible products has one.</p>
            )}
            <div className={editor.buttons}>
              <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => upload.current?.click()}>
                {busy === "upload" && <Spinner />}
                {form.image_path ? "Replace photo" : "Upload a photo"}
              </button>
              {form.image_path && (
                <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => set("image_path", null)}>
                  Remove photo
                </button>
              )}
            </div>
            <input
              ref={upload}
              type="file"
              accept="image/*"
              hidden
              aria-label="Collection photo"
              onChange={(e) => {
                void uploadPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </fieldset>
        </form>

        <aside className={editor.side}>
          <section className={editor.panel}>
            <h2>Save</h2>
            <div className={editor.buttons}>
              <button type="button" className="btn btn-primary" disabled={busy !== null || !dirty} onClick={() => void save()}>
                {busy === "save" ? <><Spinner />Saving</> : "Save"}
              </button>
            </div>
            <p className={editor.hint}>Saving changes the site straight away.</p>
            {notice && (
              <div className={`${admin.message} ${notice.error ? admin.messageError : ""}`} role={notice.error ? "alert" : "status"}>
                {notice.text}
              </div>
            )}
            {products.length === 0 && (
              <div className={editor.buttons}>
                <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void remove()}>
                  {busy === "delete" && <Spinner />}
                  Delete collection
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className={editor.section} aria-labelledby={`${ids}-products`}>
        <h2 id={`${ids}-products`} className={admin.sectionTitle}>
          Products in it ({products.length})
        </h2>
        {products.length === 0 ? (
          <p className={editor.hint}>None yet. Choose this collection in a product&apos;s editor to put it here.</p>
        ) : (
          <table className={admin.table}>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Item code</th>
                <th scope="col">On the site</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>{p.sku}</td>
                  <td>{p.visible ? "Visible" : "Hidden"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={editor.hint}>
          Products appear on its page in the category&apos;s order, set in Categories. To move a product to another collection,
          open it and choose the collection there.
        </p>
      </section>
    </div>
  );
}
