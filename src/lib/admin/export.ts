import "server-only";
import { Readable, PassThrough } from "node:stream";
import ExcelJS from "exceljs";
import { FINISH_FAMILY_NAMES } from "@/lib/types";
import type { serverClient } from "@/lib/supabase/server";
import { FIELDS, LIST_SEPARATOR, type Entity } from "./import-fields";
import type { GridState } from "./grid-state";
import { matchingIds } from "./product-query";
import { csvLine, protectCell } from "./sheets";

type Client = Awaited<ReturnType<typeof serverClient>>;

export interface ExportRequest {
  entity: Entity;
  format: "csv" | "xlsx";
  /** all: the whole entity. view: the grid's filters and sort. ids: these rows. */
  scope: "all" | "view" | "ids" | "template";
  source: "working" | "published";
  ids?: string[];
  state?: GridState;
  /** Field keys, in order. Defaults to every field. */
  columns?: string[];
}

const PAGE = 500;
/** Ids travel in the request URL; 150 of them stay well inside its limit. */
const ID_PAGE = 150;
const STATUS: Record<string, string> = { active: "Live", discontinued: "Discontinued", draft: "Draft", retired: "Retired" };
const CATEGORY_STATUS: Record<string, string> = { active: "Live", discontinued: "Hidden", draft: "Draft" };

/**
 * The rows of an export, header first, a page at a time. Every cell holds
 * what an import accepts back (names, web addresses, Live or Discontinued,
 * Yes or No), so an exported sheet can be edited and imported unchanged.
 */
async function* exportRows(supabase: Client, request: ExportRequest): AsyncGenerator<string[]> {
  const defs = FIELDS[request.entity];
  const keys = [...new Set(request.columns?.length ? request.columns : defs.map((f) => f.key))].filter((k) => defs.some((f) => f.key === k));
  // Rows must always be findable again on import.
  const identity = request.entity === "products" || request.entity === "product_finishes" ? "sku" : "slug";
  if (!keys.includes(identity)) keys.unshift(identity);
  if (request.entity !== "product_finishes" && !keys.includes("id")) keys.unshift("id");
  yield keys.map((k) => defs.find((f) => f.key === k)!.label);
  if (request.scope === "template") return;

  const pick = (row: Record<string, string>) => keys.map((k) => row[k] ?? "");

  if (request.entity === "products") {
    const order = request.scope === "view" && request.state ? await matchingIds(supabase, request.state) : request.scope === "ids" ? (request.ids ?? []) : null;
    for (let page = 0; ; page++) {
      const slice = order ? order.slice(page * ID_PAGE, (page + 1) * ID_PAGE) : null;
      if (order && slice!.length === 0) return;
      const rows = request.source === "published" ? await publishedProducts(supabase, slice, page) : await workingProducts(supabase, slice, page);
      if (slice) rows.sort((a, b) => slice.indexOf(a.id!) - slice.indexOf(b.id!));
      for (const r of rows) yield pick(r);
      if (!order && rows.length < PAGE) return;
    }
  }

  if (request.entity === "product_finishes") {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("product_finishes")
        .select("position, products!inner(sku), finishes!inner(slug)")
        .order("product_id")
        .order("position")
        .order("finish_id")
        .range(from, from + 999);
      const rows = (data ?? []).map((l) => ({ sku: l.products.sku, finish: l.finishes.slug }));
      rows.sort((a, b) => a.sku.localeCompare(b.sku));
      for (const r of rows) yield pick(r);
      if ((data ?? []).length < 1000) return;
    }
  }

  if (request.entity === "categories") {
    if (request.source === "published") {
      const { data } = await supabase.from("published_categories").select("category_id, snapshot").order("position");
      for (const c of data ?? []) {
        const s = c.snapshot as { slug: string; name: string; blurb: string[]; status: string };
        yield pick({ id: c.category_id, slug: s.slug, name: s.name, blurb: (s.blurb ?? []).join("\n\n"), status: CATEGORY_STATUS[s.status] ?? s.status });
      }
      return;
    }
    const { data } = await supabase.from("categories").select("id, slug, name, blurb, status, published_version").order("position");
    for (const c of data ?? []) {
      yield pick({ id: c.id, slug: c.slug, name: c.name, blurb: c.blurb.join("\n\n"), status: c.published_version === null ? "Draft" : (CATEGORY_STATUS[c.status] ?? c.status) });
    }
    return;
  }

  if (request.entity === "finishes") {
    const { data } = await supabase.from("finishes").select("id, slug, code, name, family, status").order("family").order("code");
    for (const f of data ?? []) {
      yield pick({ id: f.id, slug: f.slug, code: f.code, name: f.name, family: FINISH_FAMILY_NAMES[f.family as keyof typeof FINISH_FAMILY_NAMES] ?? f.family, status: STATUS[f.status] ?? f.status });
    }
  }
}

async function workingProducts(supabase: Client, ids: string[] | null, page: number): Promise<Array<Record<string, string>>> {
  let query = supabase
    .from("products")
    .select("id, sku, slug, name, description, dimensions, features, status, featured, published_version, categories(name), product_types(name), product_finishes(position, finishes(slug))");
  query = ids ? query.in("id", ids) : query.order("sku").range(page * PAGE, page * PAGE + PAGE - 1);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    category: p.categories?.name ?? "",
    type: p.product_types?.name ?? "",
    description: p.description,
    dimensions: p.dimensions ?? "",
    features: p.features.join(LIST_SEPARATOR),
    finishes: [...p.product_finishes].sort((a, b) => a.position - b.position).map((l) => l.finishes?.slug ?? "").join(LIST_SEPARATOR),
    status: p.published_version === null ? "Draft" : (STATUS[p.status] ?? p.status),
    featured: p.featured ? "Yes" : "No",
  }));
}

async function publishedProducts(supabase: Client, ids: string[] | null, page: number): Promise<Array<Record<string, string>>> {
  let query = supabase.from("published_products").select("product_id, featured, snapshot");
  query = ids ? query.in("product_id", ids) : query.order("sku").range(page * PAGE, page * PAGE + PAGE - 1);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const s = row.snapshot as {
      sku: string; slug: string; name: string; categorySlug: string; categoryName: string; type: { slug: string; name: string };
      description: string; dimensions: string | null; features: string[]; finishes: string[]; status: string;
    };
    return {
      id: row.product_id,
      sku: s.sku,
      name: s.name,
      slug: s.slug,
      category: s.categoryName,
      type: s.type.slug === s.categorySlug ? "" : s.type.name,
      description: s.description,
      dimensions: s.dimensions ?? "",
      features: s.features.join(LIST_SEPARATOR),
      finishes: s.finishes.join(LIST_SEPARATOR),
      status: STATUS[s.status] ?? s.status,
      featured: row.featured ? "Yes" : "No",
    };
  });
}

/**
 * The export as a download, written as it is read: CSV line by line, Excel
 * through exceljs's streaming writer, so memory stays flat whatever the size.
 */
export function exportStream(supabase: Client, request: ExportRequest): ReadableStream<Uint8Array> {
  const rows = exportRows(supabase, request);
  if (request.format === "csv") {
    const encoder = new TextEncoder();
    let started = false;
    return new ReadableStream({
      async pull(controller) {
        // A byte-order mark, so Excel opens it as UTF-8.
        if (!started) {
          controller.enqueue(encoder.encode("﻿"));
          started = true;
        }
        const next = await rows.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(csvLine(next.value)));
      },
    });
  }

  const pass = new PassThrough();
  void (async () => {
    try {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useSharedStrings: false, useStyles: true });
      // The streaming writer takes the frozen header row up front only.
      const sheet = workbook.addWorksheet(
        request.entity === "product_finishes" ? "Product finishes" : request.entity[0]!.toUpperCase() + request.entity.slice(1),
        { views: [{ state: "frozen", ySplit: 1 }] },
      );
      let header = true;
      for await (const row of rows) {
        const added = sheet.addRow(row.map(protectCell));
        if (header) {
          added.font = { bold: true };
          header = false;
        }
        added.commit();
      }
      sheet.commit();
      await workbook.commit();
    } catch (e) {
      pass.destroy(e instanceof Error ? e : new Error(String(e)));
    }
  })();
  return Readable.toWeb(pass) as ReadableStream<Uint8Array>;
}
