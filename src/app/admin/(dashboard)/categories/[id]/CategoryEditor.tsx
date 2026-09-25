"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { blurbFromText, blurbToText, categoryForm, type CategoryForm } from "@/lib/admin/catalogue-schema";
import admin from "../../../admin.module.css";
import editor from "../../products/[id]/editor.module.css";
import { OrderBar } from "../../OrderBar";
import { SortableList } from "../../SortableList";
import { publishCategoryNow, publishProductOrder, saveCategory } from "../actions";

interface Product {
  id: string;
  sku: string;
  name: string;
  status: string;
  imageUrl: string | null;
}

type TypeEntry = { key: string; id?: string; name: string };

interface FormState {
  name: string;
  slug: string;
  blurbText: string;
  status: "draft" | "active" | "discontinued";
  types: TypeEntry[];
}

const STATUS: Record<string, string> = { active: "Live", discontinued: "Discontinued", draft: "Draft" };

/**
 * A category: its name, address, description and product types, saved as a
 * draft and published like a product; and the order of its products, which
 * is published on its own.
 */
export function CategoryEditor({
  category,
  typeUse,
  products,
}: {
  category: {
    id: string;
    version: number;
    publishedVersion: number | null;
    updatedAt: string;
    updatedBy: string | null;
    form: Omit<CategoryForm, "types"> & { status: FormState["status"]; types: Array<{ id: string; name: string; slug: string }> };
  };
  typeUse: Record<string, number>;
  products: Product[];
}) {
  const router = useRouter();
  const ids = useId();
  const initial: FormState = {
    name: category.form.name,
    slug: category.form.slug,
    blurbText: blurbToText(category.form.blurb),
    status: category.form.status,
    types: category.form.types.map((t) => ({ key: t.id, id: t.id, name: t.name })),
  };
  const [form, setForm] = useState(initial);
  const [base, setBase] = useState(initial);
  const [version, setVersion] = useState(category.version);
  const [publishedVersion, setPublishedVersion] = useState(category.publishedVersion);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; error?: boolean; reload?: boolean } | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [newType, setNewType] = useState("");
  const [order, setOrder] = useState(products);
  const [liveOrder, setLiveOrder] = useState(products);

  // Set when the page's copy has been asked for; `notice` is what to say
  // when it arrives, if anything.
  const [reloading, setReloading] = useState<{ notice?: string } | null>(null);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(base), [form, base]);

  // The page's copy arrives again after a refresh. It replaces what is on
  // screen when asked for (new types need their ids, or "Load their
  // version"), or when it is newer and nothing here is unsaved.
  const [received, setReceived] = useState(category);
  if (category !== received) {
    setReceived(category);
    if (reloading !== null || (category.version !== version && !dirty)) {
      setForm(initial);
      setBase(initial);
      setVersion(category.version);
      setPublishedVersion(category.publishedVersion);
      setErrors({});
      if (reloading?.notice) setNotice({ text: reloading.notice });
      else if (reloading === null) setNotice(null);
    }
    setReloading(null);
  }
  const unpublished = publishedVersion === null || version !== publishedVersion;
  const locked = publishedVersion !== null;
  const liveProducts = products.filter((p) => p.status === "active").length;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toPayload = (f: FormState) => ({
    name: f.name,
    slug: f.slug,
    blurb: blurbFromText(f.blurbText),
    status: f.status,
    types: f.types.map((t) => (t.id ? { id: t.id, name: t.name } : { name: t.name })),
  });

  const save = async (): Promise<boolean> => {
    const payload = toPayload(form);
    const check = categoryForm.safeParse(payload);
    if (!check.success) {
      const fields: Record<string, string> = {};
      for (const issue of check.error.issues) fields[String(issue.path[0])] ??= issue.message;
      setErrors(fields);
      setNotice({ text: "Some fields need attention.", error: true });
      return false;
    }
    setBusy("save");
    setNotice(null);
    const result = await saveCategory({ id: category.id, version, form: payload });
    setBusy(null);
    if (!result.ok) {
      setErrors(result.fields ?? {});
      setNotice({ text: result.error, error: true, reload: Boolean(result.conflict) });
      return false;
    }
    setVersion(result.version);
    setErrors({});
    setNotice({ text: result.message });
    // New types now have ids; reload them, so a second save renames rather
    // than adding them again.
    if (form.types.some((t) => !t.id)) {
      setReloading({ notice: result.message });
      router.refresh();
    } else setBase(form);
    return true;
  };

  const publish = async () => {
    if (dirty && !(await save())) return;
    setBusy("publish");
    setNotice(null);
    const result = await publishCategoryNow({ id: category.id });
    setBusy(null);
    if (!result.ok) {
      setNotice({ text: result.error ?? "It couldn't be published.", error: true });
      return;
    }
    setPublishedVersion(result.version ?? null);
    // A reload for new types may still be on its way; it should not replace
    // this message when it lands.
    setReloading((r) => (r ? {} : r));
    if (form.status === "draft") {
      setForm((f) => ({ ...f, status: "active" }));
      setBase((b) => ({ ...b, status: "active" }));
    }
    setNotice({ text: result.message ?? "Published." });
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

  const statusLabel = publishedVersion === null ? "Draft" : form.status === "discontinued" ? "Hidden" : "Live";

  return (
    <div className={editor.editor}>
      <header className={editor.head}>
        <h1>{form.name || "Untitled category"}</h1>
        <p className={editor.badges}>
          <span className={`${admin.badge} ${statusLabel === "Live" ? "" : admin.badgeWarn}`}>{statusLabel}</span>
          {(dirty || unpublished) && (
            <span className={`${admin.badge} ${admin.badgeWarn}`}>{dirty ? "Unsaved changes" : "Unpublished changes"}</span>
          )}
          {publishedVersion !== null && statusLabel === "Live" && (
            <Link href={`/products/${form.slug}`} target="_blank" className={admin.linkButton}>
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
                  <span className={editor.prefix}>/products/</span>
                  <input {...field("slug")} className="input" value={form.slug} readOnly={locked} onChange={(e) => set("slug", e.target.value)} />
                </div>
                {error("slug")}
                {locked && <span className={editor.hint}>Fixed once published, so links to it keep working.</span>}
              </div>
            </div>
            <div className={editor.field}>
              <label htmlFor={`${ids}-blurb`} className={editor.label}>Description, a blank line between paragraphs</label>
              <textarea {...field("blurb")} className="input" rows={6} value={form.blurbText} onChange={(e) => set("blurbText", e.target.value)} />
              {error("blurb")}
            </div>
          </fieldset>

          <fieldset className={editor.section}>
            <legend>Product types</legend>
            <p className={editor.hint}>
              Every product in this category can have one of these. Renaming one changes it on every product page
              when the category is published.
            </p>
            <ul className={editor.chosen}>
              {form.types.map((t, index) => {
                const count = t.id ? typeUse[t.id] ?? 0 : 0;
                return (
                  <li key={t.key} className={editor.chosenItem}>
                    <input
                      className="input"
                      aria-label={`Type ${index + 1} name`}
                      value={t.name}
                      onChange={(e) => set("types", form.types.map((x) => (x.key === t.key ? { ...x, name: e.target.value } : x)))}
                    />
                    <span className={editor.meta}>{t.id ? `${count} product${count === 1 ? "" : "s"}` : "new"}</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={count > 0}
                      title={count > 0 ? "Products use this type. Move them to another type first." : undefined}
                      onClick={() => set("types", form.types.filter((x) => x.key !== t.key))}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className={editor.slug}>
              <input
                className="input"
                aria-label="New type name"
                placeholder="A new type, e.g. Wall hung basin"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={newType.trim() === ""}
                onClick={() => {
                  set("types", [...form.types, { key: crypto.randomUUID(), name: newType.trim() }]);
                  setNewType("");
                }}
              >
                Add type
              </button>
            </div>
            {error("types")}
          </fieldset>
        </form>

        <aside className={editor.side}>
          <section className={editor.panel}>
            <h2>Publishing</h2>
            {publishedVersion === null ? (
              <p className={editor.hint}>Not on the site yet. Publishing makes it live; it appears in the menu once it has live products.</p>
            ) : (
              <div className={editor.field} role="radiogroup" aria-label="Status">
                <label className={editor.check}>
                  <input type="radio" name="status" checked={form.status === "active"} onChange={() => set("status", "active")} />
                  Live
                </label>
                <label className={editor.check}>
                  <input type="radio" name="status" checked={form.status === "discontinued"} onChange={() => set("status", "discontinued")} />
                  Hidden: no menu entry or category page
                </label>
                {form.status === "discontinued" && liveProducts > 0 && (
                  <span className={editor.hint}>
                    Its {liveProducts} live products stay live and searchable. Discontinue or move them to take them off the site.
                  </span>
                )}
              </div>
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
                        setReloading({ notice: "Their version is loaded. Your changes were discarded." });
                        router.refresh();
                      }}
                    >
                      Load their version
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className={editor.section} aria-labelledby={`${ids}-order`}>
        <h2 id={`${ids}-order`} className={admin.sectionTitle}>
          Products, in the order the category page shows them ({order.length})
        </h2>
        {order.length === 0 ? (
          <p className={editor.hint}>No products in this category yet.</p>
        ) : (
          <>
            <OrderBar
              changed={order.some((p, i) => p.id !== liveOrder[i]?.id)}
              onPublish={async () => {
                const result = await publishProductOrder({ categoryId: category.id, ids: order.map((p) => p.id) });
                if (result.ok) setLiveOrder(order);
                return result;
              }}
              onUndo={() => setOrder(liveOrder)}
            />
            <SortableList
              items={order}
              getId={(p) => p.id}
              getLabel={(p) => `${p.sku} ${p.name}`}
              label={`Products in ${form.name}`}
              onChange={setOrder}
              render={(p) => (
                <span className={admin.orderRow}>
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt="" width={40} height={40} className={admin.orderThumb} />
                  ) : (
                    <span className={admin.orderThumb} aria-hidden="true" />
                  )}
                  <Link href={`/admin/products/${p.id}`}>{p.sku}</Link>
                  <span>{p.name}</span>
                  {p.status !== "active" && <span className={`${admin.badge} ${admin.badgeWarn}`}>{STATUS[p.status] ?? p.status}</span>}
                </span>
              )}
            />
          </>
        )}
      </section>
    </div>
  );
}
