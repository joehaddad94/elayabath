"use client";

import {
  CellStyleModule,
  CheckboxEditorModule,
  ColumnApiModule,
  InfiniteRowModelModule,
  ModuleRegistry,
  NumberFilterModule,
  RowSelectionModule,
  ScrollApiModule,
  SelectEditorModule,
  TextEditorModule,
  TextFilterModule,
  UndoRedoEditModule,
  ValidationModule,
  themeQuartz,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type IDatasource,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GridState } from "@/lib/admin/grid-state";
import type { GridRow } from "@/lib/admin/grid-types";
import styles from "../../admin.module.css";
import grid from "./grid.module.css";
import { bulkUpdate, deleteView, saveView, updateProductField } from "./actions";

/*
 * Only the Community modules the grid uses, so the dashboard downloads no
 * more of AG Grid than it needs. None is from Enterprise; the plan lists the
 * Enterprise features it does without and what replaces each. In development
 * the validation module names any module a feature needs but is missing.
 */
ModuleRegistry.registerModules([
  InfiniteRowModelModule,
  RowSelectionModule,
  ScrollApiModule,
  ColumnApiModule,
  TextFilterModule,
  NumberFilterModule,
  TextEditorModule,
  SelectEditorModule,
  CellStyleModule,
  CheckboxEditorModule,
  UndoRedoEditModule,
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

export interface Option {
  id: string;
  name: string;
  slug?: string;
}
export interface TypeOption extends Option {
  categoryId: string;
}
export interface SavedView {
  id: string;
  name: string;
  owner: string;
  shared: boolean;
  column_state: unknown[];
  filter_model: Partial<GridState>;
}

type Toolbar = Pick<GridState, "q" | "category" | "status" | "incomplete" | "changes" | "importJob">;

const EMPTY_TOOLBAR: Toolbar = { q: "", category: "", status: "", incomplete: false, changes: false, importJob: "" };

/**
 * The grid's look, built from the site's own tokens, so it follows the Ink
 * and Stone palettes like everything else. AG Grid renders real DOM, so the
 * browser audit can measure its contrast and target sizes.
 */
const theme = themeQuartz.withParams({
  backgroundColor: "var(--color-bg)",
  foregroundColor: "var(--color-text)",
  headerBackgroundColor: "var(--color-surface)",
  oddRowBackgroundColor: "color-mix(in srgb, var(--color-text) 3%, var(--color-bg))",
  borderColor: "var(--color-divider)",
  accentColor: "var(--color-accent)",
  fontFamily: "var(--font-barlow), system-ui, sans-serif",
  headerFontFamily: "var(--font-barlow-condensed), system-ui, sans-serif",
  headerFontWeight: 600,
  fontSize: 14,
  headerFontSize: 13,
  rowHeight: 48,
  headerHeight: 40,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  inputBorder: { color: "var(--color-control)" },
});

const STATUS_LABEL: Record<GridRow["status"], string> = {
  draft: "Draft",
  active: "Live",
  discontinued: "Discontinued",
};

/** Grid columns that have a spreadsheet column of their own. */
const EXPORT_FIELD: Record<string, string> = {
  sku: "sku",
  name: "name",
  category: "category",
  type: "type",
  status: "status",
  featured: "featured",
  dimensions: "dimensions",
  finishes: "finishes",
};

/** The item code opens the product editor, for everything the grid can't
 *  edit in place. */
function Sku({ value, data }: ICellRendererParams<GridRow, string>) {
  if (!data) return null;
  return (
    <Link href={`/admin/products/${data.id}`} className={grid.open}>
      {value}
    </Link>
  );
}

function Thumb({ value, data }: ICellRendererParams<GridRow, string | null>) {
  if (!value) return <span className={grid.noThumb}>none</span>;
  return <Image src={value} alt="" width={36} height={36} className={grid.thumb} aria-hidden="true" title={data?.name} />;
}

function Completeness({ value, data }: ICellRendererParams<GridRow, number>) {
  const missing = data?.missing ?? [];
  return (
    <span title={missing.length ? `Missing: ${missing.join(", ")}` : "Complete"} className={value === 6 ? "" : grid.warn}>
      {value}/6{missing.length ? ` · ${missing[0]}${missing.length > 1 ? ` +${missing.length - 1}` : ""}` : ""}
    </span>
  );
}

function Status({ value }: ICellRendererParams<GridRow, GridRow["status"]>) {
  return value ? <span className={`${styles.badge} ${grid[value]}`}>{STATUS_LABEL[value]}</span> : null;
}

function Changes({ value, data }: ICellRendererParams<GridRow, boolean>) {
  if (!value) return null;
  return (
    <span className={`${styles.badge} ${styles.badgeWarn}`}>
      {data?.published_version == null ? "Never published" : "Unpublished changes"}
    </span>
  );
}

function readUrlState(): { toolbar: Toolbar; filter: GridState["filter"]; columnState?: unknown[]; view?: string } {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("state");
  const view = params.get("view") ?? undefined;
  if (!raw) return { toolbar: EMPTY_TOOLBAR, filter: {}, view };
  try {
    const parsed = JSON.parse(raw) as { toolbar?: Partial<Toolbar>; filter?: GridState["filter"]; columns?: unknown[] };
    return { toolbar: { ...EMPTY_TOOLBAR, ...parsed.toolbar }, filter: parsed.filter ?? {}, columnState: parsed.columns, view };
  } catch {
    return { toolbar: EMPTY_TOOLBAR, filter: {}, view };
  }
}

export function ProductsGrid({
  categories,
  types,
  views: initialViews,
  me,
}: {
  categories: Option[];
  types: TypeOption[];
  views: SavedView[];
  me: string;
}) {
  const router = useRouter();
  const apiRef = useRef<GridApi<GridRow> | null>(null);
  const [toolbar, setToolbar] = useState<Toolbar>(EMPTY_TOOLBAR);
  const toolbarRef = useRef(toolbar);
  const generationRef = useRef(0);
  const [total, setTotal] = useState<number | null>(null);
  const [selected, setSelected] = useState<GridRow[]>([]);
  const [scope, setScope] = useState<"selected" | "matching">("selected");
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [views, setViews] = useState(initialViews);
  const [viewName, setViewName] = useState("");
  const [viewShared, setViewShared] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  // Which columns are hidden, as state rather than read off the grid during
  // render, so the menu can never disagree with what the grid shows.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(["updatedBy"]));

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const typeName = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);

  /** The whole state, as the server's query sees it. */
  const currentState = useCallback((): GridState => {
    const api = apiRef.current;
    const sort = (api?.getColumnState() ?? [])
      .filter((c) => c.sort)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map((c) => ({ colId: c.colId, sort: c.sort as "asc" | "desc" }));
    return { ...toolbarRef.current, sort, filter: (api?.getFilterModel() ?? {}) as GridState["filter"] };
  }, []);

  /** Mirrors the grid into the address bar, so any view is a link. */
  const syncUrl = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const payload = {
      toolbar: toolbarRef.current,
      filter: api.getFilterModel(),
      columns: api.getColumnState().map(({ colId, hide, sort, sortIndex, width, pinned }) => ({
        colId, hide, sort, sortIndex, width, pinned,
      })),
    };
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    url.searchParams.set("state", JSON.stringify(payload));
    window.history.replaceState(null, "", url);
  }, []);

  const datasource = useMemo<IDatasource>(
    () => ({
      getRows: async (params) => {
        const generation = generationRef.current;
        const state: GridState = {
          ...toolbarRef.current,
          sort: params.sortModel.map((s) => ({ colId: s.colId, sort: s.sort })),
          filter: params.filterModel as GridState["filter"],
        };
        try {
          const response = await fetch(
            `/api/admin/products?start=${params.startRow}&end=${params.endRow}&state=${encodeURIComponent(JSON.stringify(state))}`,
          );
          if (response.status === 401 || response.status === 403) {
            router.replace("/admin/sign-in?reason=removed");
            return;
          }
          if (!response.ok) throw new Error(String(response.status));
          const body = (await response.json()) as { rows: GridRow[]; lastRow: number };
          // A block asked for before the last reload answers for the old
          // filters; its count would overwrite the new one.
          if (generation !== generationRef.current) return;
          setTotal(body.lastRow);
          params.successCallback(body.rows, body.lastRow);
        } catch {
          if (generation !== generationRef.current) return;
          setNotice({ text: "Rows couldn't be loaded. Check the connection and try again.", error: true });
          params.failCallback();
        }
      },
    }),
    [router],
  );

  const refresh = useCallback(() => {
    generationRef.current += 1;
    apiRef.current?.ensureIndexVisible(0, "top");
    apiRef.current?.deselectAll();
    apiRef.current?.purgeInfiniteCache();
  }, []);

  // Toolbar changes: reload from the first row, and put them in the URL.
  useEffect(() => {
    toolbarRef.current = toolbar;
    const timer = setTimeout(() => {
      refresh();
      syncUrl();
    }, 250);
    return () => clearTimeout(timer);
  }, [toolbar, refresh, syncUrl]);

  const applyView = useCallback((view: { toolbar?: Partial<Toolbar>; filter?: GridState["filter"]; columns?: unknown[] }) => {
    const api = apiRef.current;
    if (!api) return;
    if (view.columns?.length) {
      api.applyColumnState({ state: view.columns as never, applyOrder: true });
      setHidden(new Set(api.getColumnState().filter((c) => c.hide).map((c) => c.colId)));
    }
    api.setFilterModel(view.filter ?? {});
    const next = { ...EMPTY_TOOLBAR, ...view.toolbar };
    toolbarRef.current = next;
    setToolbar(next);
  }, []);

  const onGridReady = useCallback(
    (event: GridReadyEvent<GridRow>) => {
      apiRef.current = event.api;
      const fromUrl = readUrlState();
      const saved = fromUrl.view ? views.find((v) => v.id === fromUrl.view) : undefined;
      if (saved) {
        applyView({ toolbar: saved.filter_model, filter: saved.filter_model.filter, columns: saved.column_state });
      } else if (fromUrl.columnState || Object.keys(fromUrl.filter).length || fromUrl.toolbar !== EMPTY_TOOLBAR) {
        applyView({ toolbar: fromUrl.toolbar, filter: fromUrl.filter, columns: fromUrl.columnState });
      }
      event.api.setGridOption("datasource", datasource);
    },
    [applyView, datasource, views],
  );

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent<GridRow>) => {
    const field = event.colDef.field;
    if (!field || event.oldValue === event.newValue || !event.data) return;
    const value = field === "type_id" && event.newValue === "" ? null : event.newValue;
    const result = await updateProductField({ id: event.data.id, version: event.data.version, field, value });
    if (result.row) {
      event.node.setData(result.row);
    } else if (!result.ok) {
      // setData, not setDataValue: putting the old value back must not fire
      // another save.
      event.node.setData({ ...event.data, [field]: event.oldValue });
    }
    setNotice(result.ok ? { text: `Saved “${result.row.name}” as a draft.` } : { text: result.error, error: true });
  }, []);

  const columnDefs = useMemo<ColDef<GridRow>[]>(
    () => [
      { field: "image_url", colId: "image", headerName: "", width: 64, sortable: false, resizable: false, cellRenderer: Thumb },
      { field: "sku", colId: "sku", headerName: "Item code", filter: "agTextColumnFilter", width: 170, pinned: "left", cellRenderer: Sku },
      { field: "name", colId: "name", headerName: "Name", editable: true, filter: "agTextColumnFilter", flex: 1, minWidth: 180 },
      {
        field: "category_id",
        colId: "category",
        headerName: "Category",
        width: 160,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: categories.map((c) => c.id), formatValue: (v: string) => categoryName.get(v) ?? v },
        valueFormatter: (p) => categoryName.get(p.value as string) ?? "",
      },
      {
        field: "type_id",
        colId: "type",
        headerName: "Type",
        width: 200,
        editable: true,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: (p: { data?: GridRow }) => ({
          values: ["", ...types.filter((t) => t.categoryId === p.data?.category_id).map((t) => t.id)],
          formatValue: (v: string) => (v ? typeName.get(v) ?? v : "No type"),
        }),
        valueFormatter: (p) => (p.value ? typeName.get(p.value as string) ?? "" : ""),
      },
      {
        field: "status",
        colId: "status",
        headerName: "Status",
        width: 150,
        editable: true,
        cellRenderer: Status,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["active", "discontinued"], formatValue: (v: GridRow["status"]) => STATUS_LABEL[v] },
      },
      { field: "featured", colId: "featured", headerName: "Featured", width: 110, editable: true, cellEditor: "agCheckboxCellEditor", cellRenderer: "agCheckboxCellRenderer" },
      { field: "dimensions", colId: "dimensions", headerName: "Dimensions", width: 190, editable: true, filter: "agTextColumnFilter" },
      { field: "finish_count", colId: "finishes", headerName: "Finishes", width: 110, filter: "agNumberColumnFilter", type: "rightAligned" },
      { field: "completeness", colId: "completeness", headerName: "Complete", width: 190, filter: "agNumberColumnFilter", cellRenderer: Completeness },
      { field: "has_changes", colId: "changes", headerName: "Publishing", width: 180, cellRenderer: Changes },
      {
        field: "updated_at",
        colId: "updated",
        headerName: "Last edited",
        width: 170,
        valueFormatter: (p) =>
          p.value ? new Date(p.value as string).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qatar" }) : "",
      },
      { field: "updated_by", colId: "updatedBy", headerName: "By", width: 200, hide: true },
    ],
    [categories, types, categoryName, typeName],
  );

  const runBulk = useCallback(
    async (action: "publish" | "discontinue" | "activate" | "feature" | "unfeature" | "category") => {
      if (action === "category" && !moveTo) {
        setNotice({ text: "Choose the category to move them to.", error: true });
        return;
      }
      const matching = scope === "matching";
      const count = matching ? total ?? 0 : selected.length;
      if (matching && action === "publish" && !window.confirm(`Publish all ${count} matching products to the live site?`)) return;
      setBusy(true);
      const result = await bulkUpdate({
        action,
        categoryId: action === "category" ? moveTo : undefined,
        ...(matching ? { state: currentState() } : { ids: selected.map((r) => r.id) }),
      });
      setBusy(false);
      setNotice(result.ok ? { text: result.message } : { text: result.error, error: true });
      if (result.ok) refresh();
    },
    [scope, total, selected, currentState, moveTo, refresh],
  );

  const toggleColumns = useMemo(
    () => columnDefs.filter((c) => c.colId !== "image" && c.colId !== "sku"),
    [columnDefs],
  );
  const readHidden = useCallback(() => {
    const state = apiRef.current?.getColumnState() ?? [];
    setHidden(new Set(state.filter((c) => c.hide).map((c) => c.colId)));
  }, []);

  const saveCurrentView = async () => {
    const api = apiRef.current;
    if (!api) return;
    const result = await saveView({
      name: viewName,
      shared: viewShared,
      columnState: api.getColumnState() as unknown as Record<string, unknown>[],
      state: currentState(),
    });
    if (!result.ok || !result.id) {
      setNotice({ text: result.error ?? "The view couldn't be saved.", error: true });
      return;
    }
    const state = currentState();
    setViews((vs) => [
      ...vs.filter((v) => !(v.owner === me && v.name === viewName.trim())),
      { id: result.id!, name: viewName.trim(), owner: me, shared: viewShared, column_state: api.getColumnState(), filter_model: state },
    ]);
    setNotice({ text: `Saved the view “${viewName.trim()}”.` });
    setViewName("");
  };

  /**
   * Downloads a spreadsheet through a form post (ticked rows can be too many
   * ids for a link). The view's visible columns become the export's columns,
   * in the grid's order.
   */
  const exportRows = (scope: "view" | "ids" | "all", format: "xlsx" | "csv") => {
    const visible = (apiRef.current?.getColumnState() ?? []).filter((c) => !c.hide).map((c) => EXPORT_FIELD[c.colId]).filter(Boolean);
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/admin/export";
    const fields: Record<string, string> = { entity: "products", format, scope };
    if (scope === "view") {
      fields.state = JSON.stringify(currentState());
      fields.columns = ["sku", ...visible].join(",");
    }
    if (scope === "ids") fields.ids = selected.map((r) => r.id).join(",");
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

  const selectionCount = scope === "matching" ? total ?? 0 : selected.length;

  return (
    <div className={grid.wrap}>
      {/* Toolbar: the filters people reach for first, outside the column menus. */}
      <div className={grid.toolbar}>
        <label className={grid.field}>
          <span>Search</span>
          <input
            className="input"
            type="search"
            placeholder="Name or item code"
            value={toolbar.q}
            onChange={(e) => setToolbar((t) => ({ ...t, q: e.target.value }))}
          />
        </label>
        <label className={grid.field}>
          <span>Category</span>
          <select className="input" value={toolbar.category} onChange={(e) => setToolbar((t) => ({ ...t, category: e.target.value }))}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className={grid.field}>
          <span>Status</span>
          <select
            className="input"
            value={toolbar.status}
            onChange={(e) => setToolbar((t) => ({ ...t, status: e.target.value as Toolbar["status"] }))}
          >
            <option value="">Any status</option>
            <option value="active">Live</option>
            <option value="draft">Draft</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </label>
        <label className={grid.check}>
          <input type="checkbox" checked={toolbar.incomplete} onChange={(e) => setToolbar((t) => ({ ...t, incomplete: e.target.checked }))} />
          Needs attention
        </label>
        <label className={grid.check}>
          <input type="checkbox" checked={toolbar.changes} onChange={(e) => setToolbar((t) => ({ ...t, changes: e.target.checked }))} />
          Unpublished changes
        </label>

        <div className={grid.spacer} />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="btn btn-secondary">Columns</DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={grid.menu} align="end" sideOffset={6}>
              {toggleColumns.map((c) => {
                const visible = !hidden.has(c.colId!);
                return (
                  <DropdownMenu.CheckboxItem
                    key={c.colId}
                    className={grid.menuItem}
                    checked={visible}
                    onCheckedChange={(on) => {
                      apiRef.current?.setColumnsVisible([c.colId!], Boolean(on));
                      readHidden();
                      syncUrl();
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <DropdownMenu.ItemIndicator className={grid.tick}>✓</DropdownMenu.ItemIndicator>
                    {c.headerName}
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="btn btn-secondary">Views</DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={grid.menu} align="end" sideOffset={6}>
              {views.length === 0 && <div className={grid.menuNote}>No saved views yet.</div>}
              {views.map((v) => (
                <DropdownMenu.Item
                  key={v.id}
                  className={grid.menuItem}
                  onSelect={() => {
                    applyView({ toolbar: v.filter_model, filter: v.filter_model.filter, columns: v.column_state });
                    const url = new URL(window.location.href);
                    url.searchParams.delete("state");
                    url.searchParams.set("view", v.id);
                    window.history.replaceState(null, "", url);
                  }}
                >
                  <span>{v.name}</span>
                  <span className={styles.muted}>{v.owner === me ? (v.shared ? "shared" : "mine") : v.owner}</span>
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className={grid.sep} />
              <div className={grid.saveView} onKeyDown={(e) => e.stopPropagation()}>
                <input
                  className="input"
                  placeholder="Name this view"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  aria-label="Name for the current view"
                />
                <label className={grid.check}>
                  <input type="checkbox" checked={viewShared} onChange={(e) => setViewShared(e.target.checked)} />
                  Share with the team
                </label>
                <button type="button" className="btn btn-primary" disabled={!viewName.trim()} onClick={() => void saveCurrentView()}>
                  Save current view
                </button>
              </div>
              {views.some((v) => v.owner === me) && (
                <>
                  <DropdownMenu.Separator className={grid.sep} />
                  {views
                    .filter((v) => v.owner === me)
                    .map((v) => (
                      <DropdownMenu.Item
                        key={`del-${v.id}`}
                        className={grid.menuItem}
                        onSelect={async () => {
                          if ((await deleteView(v.id)).ok) setViews((vs) => vs.filter((x) => x.id !== v.id));
                        }}
                      >
                        Delete “{v.name}”
                      </DropdownMenu.Item>
                    ))}
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="btn btn-secondary">
              Export
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={grid.menu} align="end" sideOffset={4}>
              {(["xlsx", "csv"] as const).map((format) => (
                <DropdownMenu.Item key={`view-${format}`} className={grid.menuItem} onSelect={() => exportRows("view", format)}>
                  This view, {format === "xlsx" ? "Excel" : "CSV"} ({total?.toLocaleString("en") ?? 0})
                </DropdownMenu.Item>
              ))}
              {(["xlsx", "csv"] as const).map((format) => (
                <DropdownMenu.Item
                  key={`ticked-${format}`}
                  className={grid.menuItem}
                  disabled={selected.length === 0}
                  onSelect={() => exportRows("ids", format)}
                >
                  Ticked rows, {format === "xlsx" ? "Excel" : "CSV"} ({selected.length})
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className={grid.sep} />
              <DropdownMenu.Item className={grid.menuItem} onSelect={() => exportRows("all", "xlsx")}>
                Every product, Excel
              </DropdownMenu.Item>
              <p className={grid.menuNote}>Import sheets back on the Import page; they map themselves.</p>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            syncUrl();
            void navigator.clipboard?.writeText(window.location.href);
            setNotice({ text: "Link to this view copied." });
          }}
        >
          Copy link
        </button>
      </div>

      {/* Bulk actions: the ticked rows, or everything matching the filter. */}
      <div className={grid.bulk} aria-live="polite">
        <span className={grid.count}>
          {total === null ? "Loading" : `${total.toLocaleString("en")} product${total === 1 ? "" : "s"}`}
          {selected.length > 0 && ` · ${selected.length} ticked`}
        </span>
        <div className={grid.scope} role="radiogroup" aria-label="Apply to">
          <label className={grid.check}>
            <input type="radio" name="scope" checked={scope === "selected"} onChange={() => setScope("selected")} />
            Ticked rows
          </label>
          <label className={grid.check}>
            <input type="radio" name="scope" checked={scope === "matching"} onChange={() => setScope("matching")} />
            All {total?.toLocaleString("en") ?? ""} matching
          </label>
        </div>
        <div className={grid.actions}>
          <button type="button" className="btn btn-primary" disabled={busy || selectionCount === 0} onClick={() => void runBulk("publish")}>
            Publish
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy || selectionCount === 0} onClick={() => void runBulk("discontinue")}>
            Discontinue
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy || selectionCount === 0} onClick={() => void runBulk("activate")}>
            Make live
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy || selectionCount === 0} onClick={() => void runBulk("feature")}>
            Feature
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy || selectionCount === 0} onClick={() => void runBulk("unfeature")}>
            Unfeature
          </button>
          <select className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move to category">
            <option value="">Move to…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary" disabled={busy || selectionCount === 0 || !moveTo} onClick={() => void runBulk("category")}>
            Move
          </button>
        </div>
      </div>

      {notice && (
        <p className={`${styles.message} ${notice.error ? styles.messageError : ""}`} role={notice.error ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <div className={grid.grid}>
        <AgGridReact<GridRow>
          theme={theme}
          rowModelType="infinite"
          cacheBlockSize={100}
          maxBlocksInCache={20}
          getRowId={(p) => p.data.id}
          columnDefs={columnDefs}
          defaultColDef={{ sortable: true, resizable: true, filter: false }}
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: false, enableClickSelection: false }}
          undoRedoCellEditing
          undoRedoCellEditingLimit={20}
          stopEditingWhenCellsLoseFocus
          onGridReady={onGridReady}
          onCellValueChanged={(e) => void onCellValueChanged(e)}
          onSelectionChanged={(e) => setSelected(e.api.getSelectedRows())}
          onSortChanged={syncUrl}
          onFilterChanged={syncUrl}
          onColumnResized={(e) => e.finished && syncUrl()}
          onColumnMoved={(e) => e.finished && syncUrl()}
          onColumnVisible={readHidden}
          overlayNoRowsTemplate="<span>No products match.</span>"
        />
      </div>
    </div>
  );
}
