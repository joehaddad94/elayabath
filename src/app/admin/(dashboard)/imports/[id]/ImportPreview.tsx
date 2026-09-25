"use client";

import {
  CellStyleModule,
  InfiniteRowModelModule,
  ModuleRegistry,
  RowAutoHeightModule,
  TextFilterModule,
  ValidationModule,
  themeQuartz,
  type ColDef,
  type GridApi,
  type IDatasource,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useRef, useState } from "react";
import styles from "../imports.module.css";

ModuleRegistry.registerModules([
  InfiniteRowModelModule,
  CellStyleModule,
  RowAutoHeightModule,
  TextFilterModule,
  ...(process.env.NODE_ENV !== "production" ? [ValidationModule] : []),
]);

interface PreviewRow {
  row_number: number;
  outcome: string;
  key: string | null;
  diff: Record<string, { from: string; to: string }> | null;
  errors: string[];
  applied: boolean;
}

const theme = themeQuartz.withParams({
  backgroundColor: "var(--color-surface)",
  foregroundColor: "var(--color-text)",
  headerBackgroundColor: "var(--color-bg)",
  borderColor: "var(--color-divider)",
  accentColor: "var(--color-accent)",
  fontFamily: "inherit",
});

const FILTERS = [
  ["", "All"],
  ["error", "Errors"],
  ["new", "New"],
  ["changed", "Changed"],
  ["unchanged", "Unchanged"],
  ["skipped", "Skipped"],
] as const;

/**
 * The checked rows in AG Grid, paged from the server, filterable by outcome:
 * a 5,000-row import with 12 errors is reviewed by looking at the 12.
 */
export function ImportPreview({ jobId }: { jobId: string }) {
  const api = useRef<GridApi<PreviewRow> | null>(null);
  const outcome = useRef("");
  const [chosen, setChosen] = useState("");

  const datasource = useMemo<IDatasource>(
    () => ({
      getRows: async (params) => {
        const response = await fetch(`/api/admin/imports/${jobId}/rows?start=${params.startRow}&end=${params.endRow}&outcome=${outcome.current}`);
        if (!response.ok) return params.failCallback();
        const body = (await response.json()) as { rows: PreviewRow[]; lastRow: number };
        params.successCallback(body.rows, body.lastRow);
      },
    }),
    [jobId],
  );

  const columnDefs = useMemo<ColDef<PreviewRow>[]>(
    () => [
      { field: "row_number", headerName: "Row", width: 80 },
      { field: "outcome", headerName: "Outcome", width: 120, valueFormatter: (p) => (p.value ? String(p.value)[0]!.toUpperCase() + String(p.value).slice(1) : "") },
      { field: "key", headerName: "Finds", width: 170 },
      {
        colId: "changes",
        headerName: "Changes",
        flex: 2,
        minWidth: 260,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) =>
          Object.entries(p.data?.diff ?? {})
            .map(([field, d]) => `${field}: ${d.from || "empty"} → ${d.to || "empty"}`)
            .join("\n"),
        cellClass: styles.pre,
      },
      { colId: "errors", headerName: "Problems", flex: 1, minWidth: 220, wrapText: true, autoHeight: true, valueGetter: (p) => (p.data?.errors ?? []).join("\n"), cellClass: styles.pre },
    ],
    [],
  );

  return (
    <div className={styles.preview}>
      <div className={styles.filterRow} role="group" aria-label="Show">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn ${chosen === value ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={chosen === value}
            onClick={() => {
              outcome.current = value;
              setChosen(value);
              api.current?.purgeInfiniteCache();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        <AgGridReact<PreviewRow>
          theme={theme}
          rowModelType="infinite"
          cacheBlockSize={100}
          columnDefs={columnDefs}
          getRowId={(p) => String(p.data.row_number)}
          onGridReady={(e) => {
            api.current = e.api;
            e.api.setGridOption("datasource", datasource);
          }}
        />
      </div>
    </div>
  );
}
