"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ProductRow } from "@/lib/admin/grid-types";
import { listLink, type ListFilters } from "@/lib/admin/links";
import admin from "../../admin.module.css";
import { useConfirm } from "../ConfirmDialog";
import { Spinner } from "../Spinner";
import { bulkUpdate, restoreCategories, setProductStatus, type BulkResult } from "./actions";
import { rememberList, useListMemory } from "./listMemory";
import { PhotoViewer, useHoverPreview, type PhotoProduct } from "./PhotoViewer";
import s from "./list.module.css";

export interface Option {
  id: string;
  slug: string;
  name: string;
}
export interface TypeOption {
  id: string;
  name: string;
}

export type SortKey = "site" | "name" | "code" | "edited" | "missing";

export const SORTS: Record<SortKey, string> = {
  site: "Order on the site",
  name: "Name, A to Z",
  code: "Item code",
  edited: "Last edited first",
  missing: "Most missing first",
};

export interface Filters {
  q: string;
  category: string;
  status: "" | "visible" | "hidden";
  missing: boolean;
  sort: SortKey;
}

const NO_FILTERS: Filters = { q: "", category: "", status: "", missing: false, sort: "site" };

/** A message at the foot of the screen. Errors stay until closed; anything
 *  with an Undo stays long enough to use it. */
interface Toast {
  id: number;
  text: string;
  error?: boolean;
  undo?: () => Promise<void>;
  /** An undo in progress: no buttons, and it stays until the result. */
  busy?: boolean;
}

// Elaya works in Qatar time. Fixing the zone also means the server's render
// and the browser's agree, wherever the server runs.
const edited = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Qatar" });
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
/** A server action that never answers (the connection dropped, the server
 *  failed) reads as a refusal, so nothing is left spinning. */
const UNREACHED = { ok: false as const, error: "That didn't reach the server, so nothing changed. Check the connection and try again." };
const reach = <T,>(call: Promise<T>): Promise<T | typeof UNREACHED> => call.catch(() => UNREACHED);

const plural = (n: number, word: string) => `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;

/**
 * Every product, loaded once with the page, as a plain list.
 *
 * Six hundred products is a small list: searching, filtering and sorting
 * happen in the browser, at once, with nothing to page and nothing to wait
 * for. The one change made in the list itself is showing or hiding a
 * product; everything else opens the product, which is what a click on its
 * row does.
 */
export function ProductsList({
  initialRows,
  initialFilters,
  categories,
  types,
}: {
  initialRows: ProductRow[];
  initialFilters: Partial<Filters>;
  categories: Option[];
  types: TypeOption[];
}) {
  const confirm = useConfirm();
  const ids = useId();
  const [rows, setRows] = useState(initialRows);
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, ...initialFilters });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<"show" | "hide" | "category" | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [viewing, setViewing] = useState<PhotoProduct | null>(null);
  const preview = useHoverPreview();
  const memory = useListMemory();

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const typeName = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
  const order = useMemo(() => new Map(initialRows.map((r, i) => [r.id, i])), [initialRows]);

  // What a search looks through, worked out once per row rather than per
  // keystroke.
  const haystack = useMemo(
    () =>
      new Map(
        rows.map((r) => [
          r.id,
          [r.sku, r.name, r.dimensions, categoryById.get(r.category_id)?.name, r.type_id ? typeName.get(r.type_id) : ""]
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [rows, categoryById, typeName],
  );

  // Typing stays instant; the list catches up a frame later.
  const query = useDeferredValue(filters.q);
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const category = categories.find((c) => c.slug === filters.category)?.id;
    const list = rows.filter(
      (r) =>
        (!category || r.category_id === category) &&
        (filters.status === "" || (filters.status === "visible") === (r.status === "active")) &&
        (!filters.missing || r.missing.length > 0) &&
        words.every((w) => haystack.get(r.id)!.includes(w)),
    );
    const bySite = (a: ProductRow, b: ProductRow) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
    const sorts: Record<SortKey, (a: ProductRow, b: ProductRow) => number> = {
      site: bySite,
      name: (a, b) => collator.compare(a.name, b.name) || bySite(a, b),
      code: (a, b) => collator.compare(a.sku, b.sku),
      edited: (a, b) => b.updated_at.localeCompare(a.updated_at),
      missing: (a, b) => b.missing.length - a.missing.length || bySite(a, b),
    };
    return list.sort(sorts[filters.sort]);
  }, [rows, query, filters.category, filters.status, filters.missing, filters.sort, categories, haystack, order]);

  const filtered = filters.q !== "" || filters.category !== "" || filters.status !== "" || filters.missing;
  const activeFilters = [filters.category, filters.status, filters.missing].filter(Boolean).length;

  // The address carries the filters, so a view can be bookmarked, and the
  // editor can come back to it.
  const href = useMemo(() => {
    const link = listLink({
      q: filters.q.trim(),
      category: filters.category,
      status: filters.status || undefined,
      missing: filters.missing,
    } satisfies ListFilters);
    if (filters.sort === "site") return link;
    return `${link}${link.includes("?") ? "&" : "?"}sort=${filters.sort}`;
  }, [filters]);
  useEffect(() => {
    window.history.replaceState(window.history.state, "", href);
    rememberList({ href, ids: shown.map((r) => r.id) });
  }, [href, shown]);

  // Back from the editor: the product last opened is brought into view and
  // focused, so the list picks up where it was left.
  const returnedTo = useRef(false);
  useEffect(() => {
    if (returnedTo.current || !memory?.lastId || memory.href !== href) return;
    returnedTo.current = true;
    const link = document.querySelector<HTMLAnchorElement>(`[data-product="${memory.lastId}"]`);
    link?.scrollIntoView({ block: "center" });
    link?.focus({ preventScroll: true });
  }, [memory, href]);

  // Toasts go away by themselves, except errors.
  useEffect(() => {
    if (!toast || toast.error || toast.busy) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toast.undo ? 30_000 : 6_000);
    return () => clearTimeout(timer);
  }, [toast]);
  const say = useCallback((t: Omit<Toast, "id">) => setToast({ ...t, id: Date.now() }), []);

  const merge = useCallback((fresh: ProductRow[] | undefined) => {
    if (!fresh?.length) return;
    const byId = new Map(fresh.map((r) => [r.id, r]));
    setRows((current) => current.map((r) => byId.get(r.id) ?? r));
  }, []);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  /* ── ticks: only ever the rows on screen ─────────────────────────────── */
  const tickedShown = useMemo(() => shown.filter((r) => ticked.has(r.id)), [shown, ticked]);
  const allTicked = shown.length > 0 && tickedShown.length === shown.length;
  const toShow = tickedShown.filter((r) => r.status !== "active");
  const toHide = tickedShown.filter((r) => r.status === "active");
  const moveTarget = categoryById.get(moveTo);
  const toMove = tickedShown.filter((r) => r.category_id !== moveTo);
  // A category every ticked product is already in is no place to move them.
  const tickedCategories = new Set(tickedShown.map((r) => r.category_id));

  const tickAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tickAll.current) tickAll.current.indeterminate = tickedShown.length > 0 && !allTicked;
  }, [tickedShown.length, allTicked]);

  const toggleTick = (id: string, on: boolean) =>
    setTicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /* ── one product's switch ────────────────────────────────────────────── */
  const setBusyRow = (id: string, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const switchStatus = async (row: ProductRow, status: ProductRow["status"], undoing = false) => {
    if (!undoing && status === "active" && row.image_url === null) {
      const go = await confirm({
        title: `Show “${row.name}” without a photograph?`,
        body: "It has no photograph yet, so the site will show it without one.",
        confirmLabel: "Show on site",
      });
      if (!go) return;
    }
    setBusyRow(row.id, true);
    const result = await reach(setProductStatus({ id: row.id, version: row.version, status }));
    setBusyRow(row.id, false);
    if (!result.ok) {
      merge("row" in result && result.row ? [result.row] : undefined);
      return say({ text: result.error, error: true });
    }
    merge([result.row]);
    if (undoing) return say({ text: `Undone: “${row.name}” is ${status === "active" ? "back on" : "off"} the site.` });
    say({
      text: status === "active" ? `“${row.name}” is now on the site.` : `“${row.name}” is now hidden from the site.`,
      undo: () => switchStatus(result.row, row.status, true),
    });
  };

  /* ── bulk actions ────────────────────────────────────────────────────── */
  const afterBulk = (result: BulkResult | typeof UNREACHED, undo?: () => Promise<void>) => {
    merge("rows" in result ? result.rows : undefined);
    setTicked(new Set());
    setMoveTo("");
    if (!result.ok) say({ text: result.error, error: true });
    else say({ text: result.message, undo: result.count > 0 ? undo : undefined });
  };

  const runBulk = async (action: "show" | "hide" | "category") => {
    const targets = action === "show" ? toShow : action === "hide" ? toHide : toMove;
    if (targets.length === 0) return;
    const n = plural(targets.length, "product");
    const noPhoto = targets.filter((r) => r.image_url === null).length;
    const go = await confirm(
      action === "show"
        ? {
            title: `Show ${n} on the site?`,
            body:
              noPhoto > 0
                ? `${targets.length === 1 ? "It has" : noPhoto === 1 ? "One of them has" : `${noPhoto} of them have`} no photograph and will show without one.`
                : "They appear on the site straight away. You can undo this for 30 seconds.",
            confirmLabel: "Show on site",
          }
        : action === "hide"
          ? {
              title: `Take ${n} off the site?`,
              body: "Their pages stop showing straight away. You can undo this for 30 seconds.",
              confirmLabel: "Hide from site",
            }
          : {
              title: `Move ${n} to ${moveTarget?.name}?`,
              body: "Their product type is cleared, since types belong to a category. You can undo this for 30 seconds.",
              confirmLabel: "Move",
            },
    );
    if (!go) return;

    setBulkBusy(action);
    const before = targets.map((r) => ({ id: r.id, category_id: r.category_id, type_id: r.type_id }));
    const result = await reach(
      bulkUpdate({
        action,
        categoryId: action === "category" ? moveTo : undefined,
        ids: targets.map((r) => r.id),
      }),
    );
    setBulkBusy(null);

    const changed = new Set("rows" in result ? result.rows?.map((r) => r.id) : []);
    const undo = async () => {
      const back = await reach(
        action === "category"
          ? restoreCategories(before.filter((b) => changed.has(b.id)))
          : bulkUpdate({ action: action === "show" ? "hide" : "show", ids: [...changed] }),
      );
      merge("rows" in back ? back.rows : undefined);
      say(back.ok ? { text: `Undone. ${back.message}` } : { text: back.error, error: true });
    };
    afterBulk(result, undo);
  };

  /** A spreadsheet of what the list shows, in its order: everything, or just
   *  the filtered rows. Posted, since a long list of ids is too much for a
   *  link. */
  const download = () => {
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/admin/export";
    const fields: Record<string, string> = { entity: "products", format: "xlsx", scope: filtered ? "ids" : "all" };
    if (filtered) fields.ids = shown.map((r) => r.id).join(",");
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    form.remove();
  };

  return (
    <div className={s.wrap}>
      {/* Search is always there; the other filters fold away on a phone. */}
      <div className={s.toolbar}>
        <label className={`${s.field} ${s.search}`}>
          <span>Search</span>
          <input
            className="input"
            type="search"
            placeholder="Name, item code, type, size"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </label>
        <button
          type="button"
          className={`btn btn-secondary ${s.filtersToggle}`}
          aria-expanded={filtersOpen}
          aria-controls={`${ids}-filters`}
          onClick={() => setFiltersOpen((o) => !o)}
        >
          Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </button>
        <div id={`${ids}-filters`} className={`${s.filters} ${filtersOpen ? s.filtersOpen : ""}`}>
          <label className={s.field}>
            <span>Category</span>
            <select className="input" value={filters.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span>On the site</span>
            <select className="input" value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])}>
              <option value="">Visible and hidden</option>
              <option value="visible">Visible only</option>
              <option value="hidden">Hidden only</option>
            </select>
          </label>
          <label className={s.field}>
            <span>Sort</span>
            <select className="input" value={filters.sort} onChange={(e) => set("sort", e.target.value as SortKey)}>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <option key={k} value={k}>{SORTS[k]}</option>
              ))}
            </select>
          </label>
          <label className={s.check}>
            <input type="checkbox" checked={filters.missing} onChange={(e) => set("missing", e.target.checked)} />
            Missing details
          </label>
        </div>
        <div className={s.toolbarEnd}>
          {filtered && (
            <button type="button" className={s.linkButton} onClick={() => setFilters((f) => ({ ...NO_FILTERS, sort: f.sort }))}>
              Clear filters
            </button>
          )}
          <button type="button" className="btn btn-secondary" disabled={shown.length === 0} onClick={download}>
            Download Excel
          </button>
        </div>
      </div>

      <div className={s.summary}>
        {shown.length > 0 && (
          <label className={s.tick}>
            <input
              ref={tickAll}
              type="checkbox"
              checked={allTicked}
              onChange={(e) => setTicked(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())}
            />
            <span className="sr-only">Tick all {shown.length} shown</span>
          </label>
        )}
        <p className={s.count} aria-live="polite">
          {filtered ? `Showing ${shown.length.toLocaleString("en")} of ${plural(rows.length, "product")}` : plural(rows.length, "product")}
          {tickedShown.length > 0 && ` · ${tickedShown.length.toLocaleString("en")} ticked`}
        </p>
        {tickedShown.length > 0 && (
          <button type="button" className={s.linkButton} onClick={() => setTicked(new Set())}>
            Clear ticks
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className={s.empty}>
          {rows.length === 0 ? (
            <>
              <p>No products yet.</p>
              <Link href="/admin/products/new" className="btn btn-primary">New product</Link>
            </>
          ) : (
            <>
              <p>No products match these filters.</p>
              <button type="button" className="btn btn-secondary" onClick={() => setFilters((f) => ({ ...NO_FILTERS, sort: f.sort }))}>
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className={s.list} aria-label="Products">
          <li className={s.head} aria-hidden="true">
            <span />
            <span />
            <span>Product</span>
            <span>Category and type</span>
            <span>Missing</span>
            <span>Last edited</span>
            <span>On the site</span>
          </li>
          {shown.map((r) => {
            const visible = r.status === "active";
            const category = categoryById.get(r.category_id)?.name ?? "";
            const type = r.type_id ? typeName.get(r.type_id) : null;
            return (
              <li key={r.id} className={`${s.row} ${visible ? "" : s.hidden} ${ticked.has(r.id) ? s.ticked : ""}`}>
                <label className={s.tick}>
                  <input type="checkbox" checked={ticked.has(r.id)} onChange={(e) => toggleTick(r.id, e.target.checked)} />
                  <span className="sr-only">Tick {r.name}</span>
                </label>
                <span className={s.photo}>
                  {r.image_url ? (
                    <button
                      type="button"
                      className={s.thumbButton}
                      aria-label={`Photos of ${r.name}`}
                      onPointerEnter={(e) => preview.show(r.image_url!, e.currentTarget, e.pointerType)}
                      onPointerLeave={preview.hide}
                      onClick={() => {
                        preview.hide();
                        setViewing({ id: r.id, name: r.name, sku: r.sku, thumb: r.image_url! });
                      }}
                    >
                      <Thumb src={r.image_url} />
                    </button>
                  ) : (
                    <Link href={`/admin/products/${r.id}#photographs`} className={s.noPhoto} onClick={() => rememberList({ lastId: r.id })}>
                      Add photo
                    </Link>
                  )}
                </span>
                <span className={s.name}>
                  {/* The name's link covers the whole row, so a click anywhere on it opens the product. */}
                  <Link href={`/admin/products/${r.id}`} className={s.open} data-product={r.id} onClick={() => rememberList({ lastId: r.id })}>
                    {r.name}
                  </Link>
                  <span className={s.sku}>{r.sku}</span>
                </span>
                <span className={s.meta}>
                  {category}
                  {type ? ` · ${type}` : <span className={s.faint}> · no type</span>}
                </span>
                <span className={s.missing}>
                  {r.missing.length === 0 ? <span className={s.faint}>Complete</span> : <>No {r.missing.join(", ")}</>}
                </span>
                <span className={s.edited}>{edited.format(new Date(r.updated_at))}</span>
                <span className={s.status}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={visible}
                    aria-label={`${r.name} on the site`}
                    className={s.switch}
                    disabled={busy.has(r.id)}
                    onClick={() => void switchStatus(r, visible ? "draft" : "active")}
                  >
                    {busy.has(r.id) ? (
                      <span className={`${admin.spinner} ${s.switchSpinner}`} aria-hidden="true" />
                    ) : (
                      <span className={s.track} aria-hidden="true" />
                    )}
                    {busy.has(r.id) ? "Saving" : visible ? "Visible" : "Hidden"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* The bulk actions, only while something is ticked, and only those
          that would change something. */}
      {tickedShown.length > 0 && (
        <div className={s.bulk} role="region" aria-label="Ticked products">
          <span className={s.bulkCount}>{plural(tickedShown.length, "product")} ticked</span>
          {toShow.length > 0 && (
            <button type="button" className="btn btn-secondary" disabled={bulkBusy !== null} onClick={() => void runBulk("show")}>
              {bulkBusy === "show" && <Spinner />}
              Show on site ({toShow.length})
            </button>
          )}
          {toHide.length > 0 && (
            <button type="button" className="btn btn-secondary" disabled={bulkBusy !== null} onClick={() => void runBulk("hide")}>
              {bulkBusy === "hide" && <Spinner />}
              Hide from site ({toHide.length})
            </button>
          )}
          <span className={s.move}>
            <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move to category">
              <option value="">Move to…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} disabled={tickedCategories.size === 1 && tickedCategories.has(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={bulkBusy !== null || !moveTarget || toMove.length === 0}
              onClick={() => void runBulk("category")}
            >
              {bulkBusy === "category" && <Spinner />}
              {moveTarget && toMove.length > 0 ? `Move ${toMove.length}` : "Move"}
            </button>
          </span>
        </div>
      )}

      {toast && (
        <div className={`${s.toast} ${toast.error ? s.toastError : ""}`} role={toast.error ? "alert" : "status"}>
          <p>
            {toast.busy && <Spinner />}
            {toast.text}
          </p>
          {toast.undo && !toast.busy && (
            <button
              type="button"
              className={s.toastAction}
              onClick={() => {
                const undo = toast.undo!;
                setToast({ id: Date.now(), text: "Undoing…", busy: true });
                void undo();
              }}
            >
              Undo
            </button>
          )}
          {!toast.busy && (
            <button type="button" className={s.toastClose} aria-label="Dismiss" onClick={() => setToast(null)}>
              ×
            </button>
          )}
        </div>
      )}

      {preview.element}
      <PhotoViewer product={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/** A row's photo, with a placeholder pulsing in its place until it loads.
 *  Off-screen ones load only as they scroll near. */
function Thumb({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt=""
      width={44}
      height={44}
      sizes="44px"
      loading="lazy"
      className={`${s.thumb} ${loaded ? "" : s.loadingThumb}`}
      onLoad={() => setLoaded(true)}
      // Already in the cache before the page was interactive: no load event.
      ref={(img) => {
        if (img?.complete && img.naturalWidth > 0) setLoaded(true);
      }}
    />
  );
}
