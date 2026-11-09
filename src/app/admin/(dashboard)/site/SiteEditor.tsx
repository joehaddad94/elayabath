"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Icon } from "@/components/Icon/Icon";
import { MAX_PHOTO_BYTES, formatBytes, preparePhoto } from "@/lib/admin/media";
import {
  FAQ_KEY,
  HOME_HERO_KEY,
  HOME_PRODUCTS_KEY,
  HOME_PRODUCTS_MAX,
  PHOTO_MIN_WIDTH,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  SITE_PAGES,
  WIDE_MIN_WIDTH,
  faqValue,
  originalFaq,
  originalText,
  photoFor,
  schemaFor,
  seoKey,
  sitePage,
  tileAlt,
  tileAltKey,
  categoryAsset,
  type FaqItem,
  type Item,
  type PageSlug,
  type PhotoField,
  type PhotoValue,
  type TextField,
} from "@/lib/site-content/fields";
import { browserClient } from "@/lib/supabase/browser";
import admin from "../../admin.module.css";
import editor from "../products/[id]/editor.module.css";
import { SortableList } from "../SortableList";
import { useUnsavedGuard } from "../useUnsavedGuard";
import { findProducts, saveSiteContent, type ChangeSet } from "./actions";
import type { PickerProduct } from "./picker";
import styles from "./site.module.css";

export interface Tile {
  id: string;
  slug: string;
  name: string;
  version: number;
  blurb: string[];
  image: string | null;
  icon: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
}
type TileFields = Partial<Pick<Tile, "blurb" | "image" | "icon">>;

type Content = Record<string, unknown>;
/** An edit to one key: a new value, or null for "back to the original". */
type Draft = Record<string, unknown>;

/** Every upload has a new name, so a year's caching is safe. */
const CACHE = "31536000";

async function uploadPhoto(file: File, folder: string, maxEdge: number, minWidth: number) {
  const photo = await preparePhoto(file, maxEdge);
  if (photo.width < minWidth) {
    throw new Error(
      `${file.name} wasn't used: it is ${photo.width} px wide and this place needs at least ${minWidth} px, or it looks soft. The current photo is kept.`,
    );
  }
  if (photo.blob.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} is still over ${formatBytes(MAX_PHOTO_BYTES)} after reducing it.`);
  const path = `${folder}${crypto.randomUUID()}.${photo.extension}`;
  const { error } = await browserClient()
    .storage.from("site-media")
    .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: CACHE, upsert: false });
  if (error) throw new Error(`${file.name} couldn't be uploaded: ${error.message}`);
  return { path, width: photo.width, height: photo.height };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const asText = (value: unknown) => (Array.isArray(value) ? value.join("\n") : typeof value === "string" ? value : "");

/**
 * One page of the site's own words and photos, top to bottom in the order
 * the page shows them. Nothing is stored until Save, which puts every change
 * on this page live at once and offers to undo it.
 *
 * Each item is either edited (stored) or the original wording from the code.
 * Clearing a field, or typing the original back, is the same as "Use
 * original wording": nothing empty is ever stored.
 */
export function SiteEditor({
  pageSlug,
  content: initialContent,
  tiles: initialTiles,
  products: initialProducts,
}: {
  pageSlug: PageSlug;
  content: Content;
  tiles: Tile[];
  products: PickerProduct[];
}) {
  const page = sitePage(pageSlug)!;
  const router = useRouter();
  const ids = useId();

  const [saved, setSaved] = useState<Content>(initialContent);
  const [draft, setDraft] = useState<Draft>({});
  const [tiles, setTiles] = useState(initialTiles);
  const [tileDraft, setTileDraft] = useState<Record<string, TileFields>>({});
  const [known, setKnown] = useState(() => new Map(initialProducts.map((p) => [p.id, p])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean; undo?: ChangeSet; reload?: boolean } | null>(null);

  /* ── values ── */

  const stored = (key: string) => (key in draft ? draft[key] : saved[key]);
  const isEdited = (key: string) => {
    const v = stored(key);
    return v !== undefined && v !== null;
  };
  const edit = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setNotice(null);
  };
  const tileValue = <K extends keyof TileFields>(tile: Tile, key: K): Tile[K] =>
    (tileDraft[tile.id]?.[key] ?? tile[key]) as Tile[K];
  const editTile = (id: string, fields: TileFields) => {
    setTileDraft((d) => ({ ...d, [id]: { ...d[id], ...fields } }));
    setNotice(null);
  };

  /** The edits as a save: what changed from the saved page, normalised so
   *  an empty field or the original wording clears the key. */
  const initialIds = initialProducts.map((p) => p.id);
  const changes = (): ChangeSet => {
    const set: Record<string, unknown> = {};
    const clear: string[] = [];
    for (const [key, raw] of Object.entries(draft)) {
      const value = normalise(key, raw);
      // Choosing the same products as before anyone chose stores nothing.
      if (key === HOME_PRODUCTS_KEY && !(key in saved) && same(value, initialIds)) continue;
      if (value === null) {
        if (key in saved) clear.push(key);
      } else if (!same(value, saved[key])) set[key] = value;
    }
    const tileChanges: ChangeSet["tiles"] = [];
    for (const tile of tiles) {
      const d = tileDraft[tile.id];
      if (!d) continue;
      const fields: TileFields = {};
      for (const k of ["blurb", "image", "icon"] as const) if (k in d && !same(d[k], tile[k])) Object.assign(fields, { [k]: d[k] });
      if (Object.keys(fields).length) tileChanges.push({ id: tile.id, version: tile.version, fields });
    }
    return { set, clear, tiles: tileChanges };
  };

  const pending = changes();
  const count = Object.keys(pending.set).length + pending.clear.length + pending.tiles.length;
  const dirty = count > 0;
  useUnsavedGuard(dirty);

  /* ── saving ── */

  const apply = (change: ChangeSet, versions: Record<string, number>) => {
    setSaved((s) => {
      const next = { ...s, ...change.set };
      for (const key of change.clear) delete next[key];
      return next;
    });
    setTiles((ts) =>
      ts.map((t) => {
        const c = change.tiles.find((x) => x.id === t.id);
        if (!c) return t;
        const merged = { ...t, ...c.fields, version: versions[t.id] ?? t.version };
        return { ...merged, imageUrl: categoryAsset(merged.image), iconUrl: categoryAsset(merged.icon) };
      }),
    );
  };

  const send = async (change: ChangeSet, undoing: boolean) => {
    // Checked here first, so a mistake is shown beside its field at once.
    const found: Record<string, string> = {};
    for (const [key, value] of Object.entries(change.set)) {
      const check = schemaFor(key)?.safeParse(value);
      if (check && !check.success) found[key] = check.error.issues[0]?.message ?? "Check this field.";
    }
    setErrors(found);
    if (Object.keys(found).length) {
      setNotice({ text: "Some fields need attention.", error: true });
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await saveSiteContent(change);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fields ?? {});
      setNotice({ text: result.error, error: true, reload: result.conflict });
      return;
    }
    apply(change, result.versions);
    setDraft({});
    setTileDraft({});
    setNotice(
      undoing
        ? { text: "Undone. The site is back as it was." }
        : { text: `Saved. ${page.title} shows it now.`, undo: result.undo },
    );
  };

  /* ── fields ── */

  const errorFor = (key: string) =>
    errors[key] ? (
      <span id={`${ids}-${key}-error`} className={editor.error}>
        {errors[key]}
      </span>
    ) : null;

  const tools = (key: string, extra?: React.ReactNode) => (
    <span className={styles.tools}>
      {extra}
      {isEdited(key) ? (
        <button type="button" className={admin.linkButton} onClick={() => edit(key, null)}>
          Use original wording
        </button>
      ) : (
        <span className={styles.original}>Original wording</span>
      )}
    </span>
  );

  const textInput = (key: string, kind: TextField["kind"], label: string, original: string, rows = 3) => {
    const value = isEdited(key) ? asText(stored(key)) : original;
    const common = {
      id: `${ids}-${key}`,
      className: "input",
      value,
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": errors[key] ? `${ids}-${key}-error` : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        edit(key, kind === "lines" ? e.target.value.split("\n") : e.target.value),
    };
    return kind === "textarea" || kind === "lines" ? (
      <textarea {...common} rows={kind === "lines" ? Math.max(3, value.split("\n").length) : rows} />
    ) : (
      <input {...common} type={kind === "email" ? "email" : "text"} />
    );
  };

  const renderText = (field: TextField) => {
    const original = asText(originalText(field.key));
    return (
      <div className={editor.field} key={field.key}>
        <div className={styles.labelRow}>
          <label htmlFor={`${ids}-${field.key}`} className={editor.label}>
            {field.label}
          </label>
          {tools(
            field.key,
            field.shared &&
              (field.shared.page && field.shared.page !== pageSlug ? (
                <Link href={`/admin/site/${field.shared.page}`} className={styles.original}>
                  {field.shared.label}
                </Link>
              ) : (
                <span className={styles.original}>{field.shared.label}</span>
              )),
          )}
        </div>
        {textInput(field.key, field.kind, field.label, original)}
        {field.hint && <span className={editor.hint}>{field.hint}</span>}
        {errorFor(field.key)}
      </div>
    );
  };

  const renderPhoto = (field: PhotoField) => {
    const value = stored(field.key) as PhotoValue | null | undefined;
    const shown = photoFor({ [field.key]: value }, field.key);
    const minWidth = field.wide ? WIDE_MIN_WIDTH : PHOTO_MIN_WIDTH;
    const setPhoto = (next: Partial<PhotoValue>) =>
      edit(field.key, { path: value?.path ?? null, width: value?.width ?? null, height: value?.height ?? null, alt: shown.alt, ...next });
    return (
      <PhotoInput
        key={field.key}
        id={`${ids}-${field.key}`}
        label={field.label}
        src={shown.src}
        size={`${shown.width} × ${shown.height} px`}
        alt={shown.alt}
        rule={field.wide ? `Runs the full width of the screen, so it needs at least ${WIDE_MIN_WIDTH} px.` : `At least ${PHOTO_MIN_WIDTH} px wide.`}
        edited={isEdited(field.key)}
        error={errorFor(field.key)}
        onAlt={(alt) => setPhoto({ alt })}
        onOriginal={() => edit(field.key, null)}
        upload={async (file) => {
          const photo = await uploadPhoto(file, `photos/${field.key.slice(6).replace(/\./g, "-")}/`, field.wide ? 2400 : 1600, minWidth);
          setPhoto(photo);
        }}
      />
    );
  };

  const renderItem = (item: Item, index: number) => {
    switch (item.kind) {
      case "photo":
        return renderPhoto(item);
      case "tiles":
        return <div key="tiles">{tiles.map(renderTile)}</div>;
      case "homeProducts":
        return renderProducts();
      case "faq":
        return renderFaq();
      case "counts":
        return (
          <div className={editor.field} key={`counts-${index}`}>
            <span className={editor.label}>Heading</span>
            <p className={styles.locked}>Counts the products, categories and finishes on the site, so it is always right.</p>
          </div>
        );
      default:
        return renderText(item);
    }
  };

  /* ── category tiles ── */

  const renderTile = (tile: Tile) => {
    const altKey = tileAltKey(tile.slug);
    const imageUrl = categoryAsset(tileValue(tile, "image"));
    const iconUrl = categoryAsset(tileValue(tile, "icon"));
    const blurb = tileValue(tile, "blurb");
    const shownOnHome = blurb.length > 0 && Boolean(imageUrl);
    return (
      <div key={tile.id} className={styles.tile}>
        <div className={styles.photoSide}>
          <div className={styles.tileMedia}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a preview of a fresh upload
              <img src={imageUrl} alt="" width={150} height={112} />
            ) : (
              <span className={styles.noPhoto} style={{ width: 150, height: 112 }}>No photo</span>
            )}
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a preview of a fresh upload
              <img src={iconUrl} alt="" width={48} height={48} className={styles.icon} />
            ) : (
              <span className={styles.noPhoto}>No icon</span>
            )}
          </div>
          <div className={styles.row}>
            <FileButton
              label="Replace photo"
              upload={async (file) => {
                const { path } = await uploadPhoto(file, `categories/${tile.id}/`, 1600, PHOTO_MIN_WIDTH);
                editTile(tile.id, { image: path });
              }}
            />
            <FileButton
              label="Replace icon"
              upload={async (file) => {
                const { path } = await uploadPhoto(file, `categories/${tile.id}/icon-`, 256, 32);
                editTile(tile.id, { icon: path });
              }}
            />
          </div>
        </div>
        <div className={styles.photoSide}>
          <p className={styles.labelRow}>
            <strong>{tile.name}</strong>
            <span className={styles.original}>{shownOnHome ? "On the homepage" : "Not on the homepage: it needs a description and a photo"}</span>
          </p>
          <div className={editor.field}>
            <label htmlFor={`${ids}-blurb-${tile.id}`} className={editor.label}>
              Description, a blank line between paragraphs (also on the {tile.name} page)
            </label>
            <textarea
              id={`${ids}-blurb-${tile.id}`}
              className="input"
              rows={3}
              value={blurb.join("\n\n")}
              onChange={(e) => editTile(tile.id, { blurb: e.target.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) })}
            />
          </div>
          <div className={editor.field}>
            <div className={styles.labelRow}>
              <label htmlFor={`${ids}-${altKey}`} className={editor.label}>
                Photo description, for people who can&apos;t see it
              </label>
              {tools(altKey)}
            </div>
            {textInput(altKey, "text", "Photo description", tileAlt({}, tile.slug, tile.name))}
            {errorFor(altKey)}
          </div>
        </div>
      </div>
    );
  };

  /* ── homepage products ── */

  const savedIds = Array.isArray(saved[HOME_PRODUCTS_KEY]) ? (saved[HOME_PRODUCTS_KEY] as string[]) : initialIds;
  const productIds = (Array.isArray(draft[HOME_PRODUCTS_KEY]) ? draft[HOME_PRODUCTS_KEY] : savedIds) as string[];
  const productList = productIds.flatMap((id) => (known.has(id) ? [known.get(id)!] : []));
  // As the site picks it: the starred product while it is listed with a
  // photo, otherwise the first bathtub.
  const heroId =
    productList.find((p) => p.id === stored(HOME_HERO_KEY) && p.imageUrl)?.id ??
    productList.find((p) => p.category === "Bathtubs")?.id ??
    productList[0]?.id;
  const setProducts = (list: PickerProduct[]) => edit(HOME_PRODUCTS_KEY, list.map((p) => p.id));

  const renderProducts = () => (
    <div key="products" className={editor.field}>
      <ProductSearch
        full={productList.length >= HOME_PRODUCTS_MAX}
        chosen={new Set(productIds)}
        onAdd={(p) => {
          setKnown((k) => new Map(k).set(p.id, p));
          setProducts([...productList, p]);
        }}
      />
      {errorFor(HOME_PRODUCTS_KEY)}
      {errorFor(HOME_HERO_KEY)}
      {productList.length === 0 ? (
        <p className={editor.hint}>No products chosen: the homepage shows none.</p>
      ) : (
        <SortableList
          items={productList}
          getId={(p) => p.id}
          getLabel={(p) => p.name}
          label="Products on the homepage, in order"
          onChange={setProducts}
          render={(p) => (
            <div className={styles.product}>
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a small thumbnail
                <img src={p.imageUrl} alt="" width={48} height={48} />
              ) : (
                <span className={styles.noPhoto}>No photo</span>
              )}
              <span>
                <strong>{p.name}</strong> <span className={styles.code}>{p.sku} · {p.category}</span>
                {p.hidden && <span className={styles.code}> · Hidden, so not shown</span>}
              </span>
              <span className={styles.row}>
                {p.id === heroId ? (
                  <span className={`${admin.badge}`}>Hero photo</span>
                ) : p.imageUrl ? (
                  <button type="button" className={admin.linkButton} onClick={() => edit(HOME_HERO_KEY, p.id)}>
                    Use in hero
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-icon btn-secondary"
                  aria-label={`Remove ${p.name} from the homepage`}
                  onClick={() => setProducts(productList.filter((x) => x.id !== p.id))}
                >
                  <Icon name="close" />
                </button>
              </span>
            </div>
          )}
        />
      )}
    </div>
  );

  /* ── FAQ ── */

  const faqSaved = faqValue.safeParse(saved[FAQ_KEY]);
  const faqDraft = draft[FAQ_KEY];
  const faq: FaqItem[] =
    faqDraft === null ? originalFaq() : Array.isArray(faqDraft) ? (faqDraft as FaqItem[]) : faqSaved.success ? faqSaved.data : originalFaq();
  const setFaq = (list: FaqItem[]) => edit(FAQ_KEY, list);
  // Rows need stable keys while their wording is edited and they move.
  const faqKeys = useRef(new WeakMap<FaqItem, string>());
  const keyOf = (item: FaqItem) => {
    let k = faqKeys.current.get(item);
    if (!k) faqKeys.current.set(item, (k = crypto.randomUUID()));
    return k;
  };
  const updateFaq = (index: number, patch: Partial<FaqItem>) => {
    const next = faq.map((item, i) => (i === index ? { ...item, ...patch } : item));
    // The edited row keeps its key.
    faqKeys.current.set(next[index]!, keyOf(faq[index]!));
    setFaq(next);
  };

  const renderFaq = () => (
    <div key="faq" className={styles.faq}>
      <div className={styles.labelRow}>
        <span className={editor.hint}>
          Visible questions show on the FAQ page in this order. Hidden ones are kept here for later.
        </span>
        {tools(FAQ_KEY)}
      </div>
      {errorFor(FAQ_KEY)}
      <SortableList
        items={faq}
        getId={keyOf}
        getLabel={(item) => item.q || "New question"}
        label="Questions, in order"
        onChange={setFaq}
        render={(item, index) => (
          <details className={editor.field}>
            <summary>
              <strong>{item.q || "New question"}</strong>{" "}
              <span className={`${admin.badge} ${item.visible ? "" : admin.badgeWarn}`}>{item.visible ? "Visible" : "Hidden"}</span>
            </summary>
            <div className={editor.field}>
              <label className={editor.label} htmlFor={`${ids}-q-${index}`}>Question</label>
              <input id={`${ids}-q-${index}`} className="input" value={item.q} onChange={(e) => updateFaq(index, { q: e.target.value })} />
              <label className={editor.label} htmlFor={`${ids}-a-${index}`}>Answer</label>
              <textarea id={`${ids}-a-${index}`} className="input" rows={4} value={item.a} onChange={(e) => updateFaq(index, { a: e.target.value })} />
              <div className={styles.row}>
                <label className={editor.check}>
                  <input type="checkbox" checked={item.visible} onChange={(e) => updateFaq(index, { visible: e.target.checked })} />
                  Show on the site
                </label>
                <button type="button" className="btn btn-secondary" onClick={() => setFaq(faq.filter((_, i) => i !== index))}>
                  Delete this question
                </button>
              </div>
            </div>
          </details>
        )}
      />
      <p>
        <button type="button" className="btn btn-secondary" onClick={() => setFaq([...faq, { q: "", a: "", visible: false }])}>
          <Icon name="plus" /> Add a question
        </button>
      </p>
    </div>
  );

  /* ── SEO ── */

  const renderSeo = () => {
    if (!page.seo) return null;
    const part = (which: "title" | "description", limit: number) => {
      const key = seoKey(pageSlug, which);
      const original = page.seo![which];
      const length = (isEdited(key) ? asText(stored(key)) : original).length;
      return (
        <div className={editor.field}>
          <div className={styles.labelRow}>
            <label htmlFor={`${ids}-${key}`} className={editor.label}>
              {which === "title" ? "Page title" : "Description"}
            </label>
            {tools(
              key,
              <span className={`${styles.counter} ${length > limit ? styles.over : ""}`}>
                {length} / {limit}
              </span>,
            )}
          </div>
          {textInput(key, which === "title" ? "text" : "textarea", which, original, 2)}
          {length > limit && (
            <span className={editor.hint}>
              {length - limit} characters over. Google cuts it off at about {limit}, so the end won&apos;t show. It still saves.
            </span>
          )}
          {errorFor(key)}
        </div>
      );
    };
    return (
      <fieldset className={editor.section}>
        <legend>Search engines</legend>
        <p className={editor.hint}>What Google shows for this page.</p>
        {part("title", SEO_TITLE_LIMIT)}
        {part("description", SEO_DESCRIPTION_LIMIT)}
      </fieldset>
    );
  };

  /* ── the page ── */

  return (
    <div className={styles.layout}>
      <nav className={styles.pages} aria-label="Site pages">
        {SITE_PAGES.map((p) => (
          <Link key={p.slug} href={`/admin/site/${p.slug}`} aria-current={p.slug === pageSlug ? "page" : undefined}>
            {p.title}
          </Link>
        ))}
      </nav>

      <form
        className={styles.body}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && !busy) void send(pending, false);
        }}
      >
        <header className={styles.title}>
          <h1>{page.title}</h1>
          <a className="btn btn-secondary" href={page.path} target="_blank" rel="noreferrer">
            Open the page <Icon name="externalLink" size={16} />
          </a>
        </header>
        <p className={editor.hint}>
          Save puts this page&apos;s changes on the site straight away. A field left empty shows the original wording.
          {page.intro && <> {page.intro}</>}
          {pageSlug === "about" && (
            <>
              {" "}
              <Link href="/admin/site/home">Edit them on the Homepage.</Link>
            </>
          )}
        </p>

        {page.groups.map((group) => (
          <fieldset key={group.heading} className={editor.section}>
            <legend>{group.heading}</legend>
            {group.note && <p className={editor.hint}>{group.note}</p>}
            {group.items.map(renderItem)}
          </fieldset>
        ))}

        {renderSeo()}

        <div className={styles.saveBar}>
          {notice ? (
            <span className={`${admin.message} ${notice.error ? admin.messageError : ""}`} role={notice.error ? "alert" : "status"} style={{ margin: 0 }}>
              {notice.text}
              {notice.reload && (
                <>
                  {" "}
                  <button type="button" className={admin.linkButton} onClick={() => router.refresh()}>
                    Reload
                  </button>
                </>
              )}
            </span>
          ) : (
            <span>{dirty ? `${count} unsaved change${count === 1 ? "" : "s"} on this page` : "No unsaved changes"}</span>
          )}
          <span className={styles.actions}>
            {notice?.undo && !dirty && (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void send(notice.undo!, true)}>
                Undo this save
              </button>
            )}
            {dirty && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  setDraft({});
                  setTileDraft({});
                  setErrors({});
                  setNotice(null);
                }}
              >
                Discard
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!dirty || busy}>
              {busy ? "Saving" : "Save and publish"}
            </button>
          </span>
        </div>
      </form>
    </div>
  );
}

/** A value as it is stored: the original wording becomes "no value", so an
 *  edit that changes nothing never stores a copy of the original. */
function normalise(key: string, raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (key === HOME_PRODUCTS_KEY || key === HOME_HERO_KEY) return raw;
  if (key === FAQ_KEY) return same(raw, originalFaq()) ? null : raw;
  if (key.startsWith("photo.")) {
    const v = raw as PhotoValue;
    const original = photoFor({}, key as `photo.${string}`);
    return !v.path && v.alt.trim() === original.alt ? null : { ...v, alt: v.alt.trim() };
  }
  const original = originalText(key);
  if (Array.isArray(raw)) {
    const lines = raw.map((l: string) => l.trim()).filter(Boolean);
    return lines.length === 0 || same(lines, original) ? null : lines;
  }
  const text = String(raw).trim();
  if (text === "") return null;
  if (key.startsWith("seo.")) {
    const [, slug, part] = key.split(".") as [string, PageSlug, "title" | "description"];
    return text === sitePage(slug)?.seo?.[part] ? null : text;
  }
  if (key.startsWith("home.tileAlt.")) return text === tileAlt({}, key.slice("home.tileAlt.".length), "") ? null : text;
  return text === original ? null : text;
}

/* ── small parts ─────────────────────────────────────────────────────── */

function FileButton({ label, upload }: { label: string; upload: (file: File) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; problem?: string }>({ busy: false });
  return (
    <>
      <button type="button" className="btn btn-secondary" disabled={state.busy} onClick={() => input.current?.click()}>
        {state.busy ? "Uploading" : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setState({ busy: true });
          try {
            await upload(file);
            setState({ busy: false });
          } catch (err) {
            setState({ busy: false, problem: err instanceof Error ? err.message : `${file.name} couldn't be uploaded.` });
          }
        }}
      />
      {state.problem && (
        <span className={admin.message} role="alert" style={{ margin: 0, flexBasis: "100%" }}>
          {state.problem}
        </span>
      )}
    </>
  );
}

function PhotoInput(props: {
  id: string;
  label: string;
  src: string;
  size: string;
  alt: string;
  rule: string;
  edited: boolean;
  error: React.ReactNode;
  onAlt: (alt: string) => void;
  onOriginal: () => void;
  upload: (file: File) => Promise<void>;
}) {
  return (
    <div className={editor.field}>
      <div className={styles.labelRow}>
        <span className={editor.label}>{props.label}</span>
        <span className={styles.tools}>
          {props.edited ? (
            <button type="button" className={admin.linkButton} onClick={props.onOriginal}>
              Use original photo
            </button>
          ) : (
            <span className={styles.original}>Original photo</span>
          )}
        </span>
      </div>
      <div className={styles.photo}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a preview, possibly of a fresh upload */}
        <img src={props.src} alt="" />
        <div className={styles.photoSide}>
          <div className={styles.row}>
            <FileButton label="Replace photo" upload={props.upload} />
            <span className={styles.code}>{props.size}</span>
          </div>
          <span className={editor.hint}>{props.rule}</span>
          <div className={editor.field}>
            <label htmlFor={props.id} className={editor.label}>
              Description, for people who can&apos;t see it (required)
            </label>
            <input id={props.id} className="input" value={props.alt} onChange={(e) => props.onAlt(e.target.value)} />
            {props.error}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductSearch({ full, chosen, onAdd }: { full: boolean; chosen: Set<string>; onAdd: (p: PickerProduct) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const latest = useRef(0);
  const search = async (q: string) => {
    setQuery(q);
    const ticket = ++latest.current;
    const found = q.trim().length < 2 ? [] : await findProducts(q);
    // Only the answer to the latest keystroke is shown.
    if (ticket === latest.current) setResults(found);
  };
  return (
    <div className={editor.field}>
      <label htmlFor={id} className={editor.label}>
        Add a product: name or item code
      </label>
      <input id={id} className="input" type="search" value={query} disabled={full} onChange={(e) => void search(e.target.value)} />
      {full && <span className={editor.hint}>The homepage shows {HOME_PRODUCTS_MAX}. Remove one to add another.</span>}
      {results.length > 0 && !full && (
        <ul className={styles.results} aria-label="Matching products">
          {results.map((p) => (
            <li key={p.id} className={styles.product}>
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a small thumbnail
                <img src={p.imageUrl} alt="" width={48} height={48} />
              ) : (
                <span className={styles.noPhoto}>No photo</span>
              )}
              <span>
                <strong>{p.name}</strong> <span className={styles.code}>{p.sku} · {p.category}</span>
              </span>
              {chosen.has(p.id) ? (
                <span className={styles.code}>Already on the homepage</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    onAdd(p);
                    setQuery("");
                    setResults([]);
                  }}
                >
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
