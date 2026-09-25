import "server-only";
import { categoryForm, finishForm, slugify } from "./catalogue-schema";
import { FIELDS, LIST_SEPARATOR, type Entity, type ImportOptions } from "./import-fields";
import { productFields, slugFromSku } from "./product-schema";
import { FINISH_FAMILY_NAMES } from "@/lib/types";
import type { serverClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof serverClient>>;

/** One sheet row, as import_rows holds it before and after staging. */
export interface RawRow {
  row_number: number;
  raw: string[];
}

export interface StagedRow {
  row_number: number;
  key: string | null;
  outcome: "new" | "changed" | "unchanged" | "skipped" | "error";
  parsed: { id: string | null; fields: Record<string, unknown>; finishes?: string[] } | null;
  diff: Record<string, { from: string; to: string }> | null;
  errors: string[];
  base_version: number | null;
}

export interface Job {
  id: string;
  entity: Entity;
  /** Column index (as text) → field key. */
  columns: Record<string, string>;
  options: ImportOptions;
}

const split = (value: string) =>
  value
    .split(/\s*\|\s*|\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

const YES = new Set(["yes", "y", "true", "1", "featured", "x"]);
const NO = new Set(["no", "n", "false", "0", ""]);

/** Reads the mapped cells of a row: field key → trimmed text. */
function cells(job: Job, raw: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const [index, key] of Object.entries(job.columns)) out.set(key, (raw[Number(index)] ?? "").trim());
  return out;
}

/**
 * Stages a chunk of rows: each is read, resolved against the database
 * (categories, types and finishes by name, code or address), validated by
 * the same schemas the editors use, and compared with the row it would
 * change. Nothing is written to the catalogue here.
 */
export async function stageRows(supabase: Client, job: Job, rows: RawRow[]): Promise<StagedRow[]> {
  if (job.entity === "products" || job.entity === "product_finishes") return stageProducts(supabase, job, rows);
  if (job.entity === "categories") return stageCategories(supabase, job, rows);
  return stageFinishes(supabase, job, rows);
}

/* ── products (and product finish links, grouped per product) ─────────── */

async function stageProducts(supabase: Client, job: Job, rows: RawRow[]): Promise<StagedRow[]> {
  const identity = job.options.identity;
  const keys = rows.map((r) => cells(job, r.raw).get(identity) ?? "").filter(Boolean);

  const [{ data: categories }, { data: types }, { data: finishes }, { data: existing }] = await Promise.all([
    supabase.from("categories").select("id, slug, name"),
    supabase.from("product_types").select("id, name, category_id"),
    supabase.from("finishes").select("id, slug, code, name, status"),
    supabase
      .from("products")
      .select("id, sku, slug, name, category_id, type_id, description, dimensions, features, status, featured, version, published_version, product_finishes(finish_id, position)")
      .in(identity === "id" ? "id" : "sku", keys.filter((k) => identity !== "id" || /^[0-9a-f-]{36}$/i.test(k))),
  ]);
  const categoryBy = new Map<string, { id: string; name: string }>();
  for (const c of categories ?? []) {
    categoryBy.set(norm(c.slug), c);
    categoryBy.set(norm(c.name), c);
  }
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const typeName = new Map((types ?? []).map((t) => [t.id, t.name]));
  const finishBySlug = new Map((finishes ?? []).map((f) => [norm(f.slug), f]));
  const finishesByCode = new Map<string, typeof finishes>();
  for (const f of finishes ?? []) finishesByCode.set(norm(f.code), [...(finishesByCode.get(norm(f.code)) ?? []), f]);
  const finishLabel = new Map((finishes ?? []).map((f) => [f.id, `${f.code} ${f.name}`]));
  const byKey = new Map((existing ?? []).map((p) => [identity === "id" ? p.id : p.sku, p]));

  const out: StagedRow[] = [];
  for (const row of rows) {
    const values = cells(job, row.raw);
    const key = values.get(identity) ?? "";
    const errors: string[] = [];
    const staged = (s: Partial<StagedRow>): StagedRow => ({
      row_number: row.row_number,
      key: key || null,
      outcome: "error",
      parsed: null,
      diff: null,
      errors,
      base_version: null,
      ...s,
    });

    if (!key) {
      errors.push(identity === "id" ? "No ID." : "No item code.");
      out.push(staged({}));
      continue;
    }
    const current = byKey.get(key);
    if (!current && (identity === "id" || job.entity === "product_finishes")) {
      errors.push(identity === "id" ? `No product has the ID ${key}.` : `No product has the item code ${key}.`);
      out.push(staged({}));
      continue;
    }
    if (!current && job.options.unknown === "skip") {
      out.push(staged({ outcome: "skipped" }));
      continue;
    }

    const fields: Record<string, unknown> = {};
    const diff: Record<string, { from: string; to: string }> = {};
    let finishIds: string[] | undefined;

    const take = (fieldKey: string, label: string, value: unknown, from: string, to: string) => {
      fields[fieldKey] = value;
      diff[label] = { from, to };
    };

    const categoryId = (() => {
      const v = values.get("category");
      if (v === undefined || (v === "" && job.options.blanks === "keep")) return current?.category_id;
      const found = categoryBy.get(norm(v));
      if (!found) {
        errors.push(v === "" ? "Category can't be blank." : `No category called "${v}".`);
        return current?.category_id;
      }
      return found.id;
    })();

    // A product-finish sheet is grouped per product before staging (see the
    // import actions), so it arrives as an item code and a finish list.
    for (const def of FIELDS.products) {
      const raw = job.entity === "product_finishes" ? (def.key === "finishes" ? values.get("finish") : undefined) : values.get(def.key);
      if (raw === undefined || def.key === "id") continue;
      const blank = raw === "";
      if (blank && job.options.blanks === "keep") continue;
      if (blank && def.required) {
        errors.push(`${def.label} can't be blank.`);
        continue;
      }

      switch (def.key) {
        case "sku":
        case "name":
        case "slug": {
          const parsed = productFields[def.key].safeParse(raw);
          if (!parsed.success) errors.push(`${def.label}: ${parsed.error.issues[0]?.message}`);
          else if (!current || current[def.key] !== parsed.data) take(def.key, def.label, parsed.data, current?.[def.key] ?? "", parsed.data);
          break;
        }
        case "category":
          if (categoryId && categoryId !== current?.category_id) {
            take("category_id", def.label, categoryId, categoryName.get(current?.category_id ?? "") ?? "", categoryName.get(categoryId) ?? "");
          }
          break;
        case "type": {
          let typeId: string | null = null;
          if (!blank) {
            const found = (types ?? []).find((t) => t.category_id === categoryId && norm(t.name) === norm(raw));
            if (!found) {
              errors.push(`No type "${raw}" in ${categoryName.get(categoryId ?? "") ?? "that category"}. Add it to the category first.`);
              break;
            }
            typeId = found.id;
          }
          if (typeId !== (current?.type_id ?? null)) take("type_id", def.label, typeId, typeName.get(current?.type_id ?? "") ?? "", typeName.get(typeId ?? "") ?? "");
          break;
        }
        case "description":
        case "dimensions": {
          const parsed = productFields[def.key].safeParse(raw);
          if (!parsed.success) {
            errors.push(`${def.label}: ${parsed.error.issues[0]?.message}`);
            break;
          }
          const next = def.key === "description" ? (parsed.data ?? "") : parsed.data;
          if ((current?.[def.key] ?? (def.key === "description" ? "" : null)) !== next) {
            take(def.key, def.label, next, current?.[def.key] ?? "", next ?? "");
          }
          break;
        }
        case "features": {
          const parsed = productFields.features.safeParse(split(raw));
          if (!parsed.success) errors.push(`${def.label}: ${parsed.error.issues[0]?.message}`);
          else if ((current?.features ?? []).join("\n") !== parsed.data.join("\n")) {
            take("features", def.label, parsed.data, (current?.features ?? []).join(LIST_SEPARATOR), parsed.data.join(LIST_SEPARATOR));
          }
          break;
        }
        case "finishes": {
          const ids: string[] = [];
          for (const value of split(raw)) {
            const bySlug = finishBySlug.get(norm(value));
            const byCode = finishesByCode.get(norm(value)) ?? [];
            const found = bySlug ?? (byCode.length === 1 ? byCode[0] : undefined);
            if (!found) {
              errors.push(
                byCode.length > 1
                  ? `The code ${value} belongs to ${byCode.map((f) => f.name).join(" and ")}. Use the finish's web address instead.`
                  : `No finish "${value}".`,
              );
            } else if (!ids.includes(found.id)) ids.push(found.id);
          }
          const before = [...(current?.product_finishes ?? [])].sort((a, b) => a.position - b.position).map((l) => l.finish_id);
          if (before.join() !== ids.join()) {
            finishIds = ids;
            diff[def.label] = {
              from: before.map((id) => finishLabel.get(id)).join(LIST_SEPARATOR),
              to: ids.map((id) => finishLabel.get(id)).join(LIST_SEPARATOR),
            };
          }
          break;
        }
        case "status": {
          const v = norm(raw);
          // "Draft" is what export writes for a product never published; it
          // means nothing to change while the product is still a draft.
          if (v === "draft" && (!current || current.published_version === null)) break;
          const status = v === "live" || v === "active" ? "active" : v === "discontinued" ? "discontinued" : null;
          if (!status) errors.push(`Status "${raw}" isn't Live or Discontinued.`);
          else if (!current) break; // new products start as drafts
          else if (current.published_version === null) break; // so do unpublished ones
          else if (current.status !== status) take("status", def.label, status, current.status, status);
          break;
        }
        case "featured": {
          const v = norm(raw);
          const featured = YES.has(v) ? true : NO.has(v) ? false : null;
          if (featured === null) errors.push(`Featured "${raw}" isn't Yes or No.`);
          else if ((current?.featured ?? false) !== featured) take("featured", def.label, featured, current?.featured ? "Yes" : "No", featured ? "Yes" : "No");
          break;
        }
      }
    }

    // Moving category drops a type from the old one, as the editor does.
    if (current && fields.category_id && !("type_id" in fields) && current.type_id) {
      const fits = (types ?? []).some((t) => t.id === current.type_id && t.category_id === fields.category_id);
      if (!fits) take("type_id", "Type", null, typeName.get(current.type_id) ?? "", "");
    }

    if (!current) {
      if (identity === "sku") fields.sku = key;
      if (!fields.name) errors.push("A new product needs a name.");
      if (!fields.category_id) errors.push("A new product needs a category.");
      if (!fields.slug) {
        fields.slug = slugFromSku(key);
        diff["Web address"] = { from: "", to: String(fields.slug) };
      }
      if (fields.sku) {
        const parsed = productFields.sku.safeParse(fields.sku);
        if (!parsed.success) errors.push(`Item code: ${parsed.error.issues[0]?.message}`);
      }
    }

    if (errors.length) {
      out.push(staged({}));
      continue;
    }
    const changed = Object.keys(diff).length > 0;
    out.push(
      staged({
        outcome: !current ? "new" : changed ? "changed" : "unchanged",
        parsed: { id: current?.id ?? null, fields, ...(finishIds ? { finishes: finishIds } : {}) },
        diff: changed || !current ? diff : null,
        base_version: current?.version ?? null,
      }),
    );
  }

  await checkTaken(supabase, out);
  return out;
}

/* ── categories ────────────────────────────────────────────────────────── */

async function stageCategories(supabase: Client, job: Job, rows: RawRow[]): Promise<StagedRow[]> {
  const identity = job.options.identity;
  const keys = rows.map((r) => cells(job, r.raw).get(identity) ?? "").filter(Boolean);
  const { data: existing } = await supabase
    .from("categories")
    .select("id, slug, name, blurb, status, version, published_version")
    .in(identity, keys.filter((k) => identity !== "id" || /^[0-9a-f-]{36}$/i.test(k)));
  const byKey = new Map((existing ?? []).map((c) => [identity === "id" ? c.id : c.slug, c]));

  return rows.map((row) => {
    const values = cells(job, row.raw);
    const key = values.get(identity) ?? "";
    const current = byKey.get(key);
    const errors: string[] = [];
    const fields: Record<string, unknown> = {};
    const diff: Record<string, { from: string; to: string }> = {};
    const base = { row_number: row.row_number, key: key || null, parsed: null, diff: null, base_version: null };
    if (!key) return { ...base, outcome: "error" as const, errors: [identity === "id" ? "No ID." : "No web address."] };
    if (!current && identity === "id") return { ...base, outcome: "error" as const, errors: [`Nothing has the ID ${key}.`] };
    if (!current && job.options.unknown === "skip") return { ...base, outcome: "skipped" as const, errors };

    for (const def of FIELDS.categories) {
      const raw = values.get(def.key);
      if (raw === undefined || def.key === "id" || (def.key === identity && current)) continue;
      if (raw === "" && job.options.blanks === "keep") continue;
      if (raw === "" && def.required) {
        errors.push(`${def.label} can't be blank.`);
        continue;
      }
      if (def.key === "name" || def.key === "slug") {
        const parsed = categoryForm.shape[def.key].safeParse(raw);
        if (!parsed.success) errors.push(`${def.label}: ${parsed.error.issues[0]?.message}`);
        else if (current?.[def.key] !== parsed.data) {
          if (def.key === "slug" && current?.published_version != null) errors.push("A published category keeps its web address.");
          else {
            fields[def.key] = parsed.data;
            diff[def.label] = { from: current?.[def.key] ?? "", to: parsed.data };
          }
        }
      } else if (def.key === "blurb") {
        const parsed = categoryForm.shape.blurb.safeParse(raw.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()));
        if (!parsed.success) errors.push(`${def.label}: ${parsed.error.issues[0]?.message}`);
        else if ((current?.blurb ?? []).join("\n\n") !== parsed.data.join("\n\n")) {
          fields.blurb = parsed.data;
          diff[def.label] = { from: (current?.blurb ?? []).join("\n\n"), to: parsed.data.join("\n\n") };
        }
      } else if (def.key === "status") {
        const v = norm(raw);
        if (v === "draft" && (!current || current.published_version === null)) continue;
        const status = v === "live" || v === "active" ? "active" : v === "hidden" || v === "discontinued" ? "discontinued" : null;
        if (!status) errors.push(`Status "${raw}" isn't Live or Hidden.`);
        else if (current && current.published_version !== null && current.status !== status) {
          fields.status = status;
          diff[def.label] = { from: current.status, to: status };
        }
      }
    }
    if (!current) {
      if (identity === "slug") fields.slug = key;
      if (!fields.name) errors.push("A new category needs a name.");
      if (!fields.slug && fields.name) fields.slug = slugify(String(fields.name));
    }
    if (errors.length) return { ...base, outcome: "error" as const, errors };
    const changed = Object.keys(diff).length > 0;
    return {
      ...base,
      outcome: !current ? ("new" as const) : changed ? ("changed" as const) : ("unchanged" as const),
      parsed: { id: current?.id ?? null, fields },
      diff: changed || !current ? diff : null,
      errors,
      base_version: current?.version ?? null,
    };
  });
}

/* ── finishes ──────────────────────────────────────────────────────────── */

async function stageFinishes(supabase: Client, job: Job, rows: RawRow[]): Promise<StagedRow[]> {
  const identity = job.options.identity;
  const keys = rows.map((r) => cells(job, r.raw).get(identity) ?? "").filter(Boolean);
  const { data: existing } = await supabase
    .from("finishes")
    .select("id, slug, code, name, family, status, version, published_version")
    .in(identity, keys.filter((k) => identity !== "id" || /^[0-9a-f-]{36}$/i.test(k)));
  const byKey = new Map((existing ?? []).map((f) => [identity === "id" ? f.id : f.slug, f]));
  const familyBy = new Map<string, string>();
  for (const [key, label] of Object.entries(FINISH_FAMILY_NAMES)) {
    familyBy.set(norm(key), key);
    familyBy.set(norm(label), key);
  }

  const out: StagedRow[] = rows.map((row) => {
    const values = cells(job, row.raw);
    const key = values.get(identity) ?? "";
    const current = byKey.get(key);
    const errors: string[] = [];
    const fields: Record<string, unknown> = {};
    const diff: Record<string, { from: string; to: string }> = {};
    const base = { row_number: row.row_number, key: key || null, parsed: null, diff: null, base_version: null };
    if (!key) return { ...base, outcome: "error" as const, errors: [identity === "id" ? "No ID." : "No web address."] };
    if (!current && identity === "id") return { ...base, outcome: "error" as const, errors: [`Nothing has the ID ${key}.`] };
    if (!current && job.options.unknown === "skip") return { ...base, outcome: "skipped" as const, errors };

    for (const def of FIELDS.finishes) {
      const raw = values.get(def.key);
      if (raw === undefined || def.key === "id" || (def.key === identity && current)) continue;
      if (raw === "" && job.options.blanks === "keep") continue;
      if (raw === "" && def.required) {
        errors.push(`${def.label} can't be blank.`);
        continue;
      }
      let value: string | null = raw;
      if (def.key === "family") {
        value = familyBy.get(norm(raw)) ?? null;
        if (!value) {
          errors.push(`Material "${raw}" isn't one of ${Object.values(FINISH_FAMILY_NAMES).join(", ")}.`);
          continue;
        }
      } else if (def.key === "status") {
        const v = norm(raw);
        value = v === "active" || v === "live" ? "active" : v === "retired" ? "retired" : null;
        if (!value) {
          errors.push(`Status "${raw}" isn't Active or Retired.`);
          continue;
        }
      } else {
        const parsed = finishForm.shape[def.key as "slug" | "code" | "name"].safeParse(raw);
        if (!parsed.success) {
          errors.push(`${def.label}: ${parsed.error.issues[0]?.message}`);
          continue;
        }
        value = parsed.data;
      }
      const before = current ? String(current[def.key as keyof typeof current] ?? "") : "";
      if (before !== value) {
        if (def.key === "slug" && current?.published_version != null) {
          errors.push("A published finish keeps its web address.");
          continue;
        }
        fields[def.key] = value;
        diff[def.label] = { from: before, to: value };
      }
    }
    if (!current) {
      if (identity === "slug") fields.slug = key;
      for (const need of ["code", "name", "family"] as const) {
        if (!fields[need]) errors.push(`A new finish needs a ${need === "family" ? "material" : need}.`);
      }
      if (!fields.slug && fields.code && fields.name) fields.slug = slugify(`${fields.code} ${fields.name}`);
    }
    if (errors.length) return { ...base, outcome: "error" as const, errors };
    const changed = Object.keys(diff).length > 0;
    return {
      ...base,
      outcome: !current ? ("new" as const) : changed ? ("changed" as const) : ("unchanged" as const),
      parsed: { id: current?.id ?? null, fields },
      diff: changed || !current ? diff : null,
      errors,
      base_version: current?.version ?? null,
    };
  });
  return out;
}

/* ── shared ────────────────────────────────────────────────────────────── */

/** A new product's item code or web address that another product already
 *  has, or that still redirects to one, would fail at apply time; say so
 *  now, on the row. */
async function checkTaken(supabase: Client, rows: StagedRow[]) {
  const fresh = rows.filter((r) => r.outcome === "new" || (r.outcome === "changed" && (r.parsed?.fields.slug || r.parsed?.fields.sku)));
  if (!fresh.length) return;
  const slugs = fresh.map((r) => String(r.parsed?.fields.slug ?? "")).filter(Boolean);
  const skus = fresh.map((r) => String(r.parsed?.fields.sku ?? "")).filter(Boolean);
  const [{ data: slugOwners }, { data: skuOwners }, { data: redirects }] = await Promise.all([
    slugs.length ? supabase.from("products").select("id, slug").in("slug", slugs) : Promise.resolve({ data: [] as Array<{ id: string; slug: string }> }),
    skus.length ? supabase.from("products").select("id, sku").in("sku", skus) : Promise.resolve({ data: [] as Array<{ id: string; sku: string }> }),
    slugs.length ? supabase.from("redirects").select("from_slug, product_id").in("from_slug", slugs) : Promise.resolve({ data: [] as Array<{ from_slug: string; product_id: string }> }),
  ]);
  for (const r of fresh) {
    const own = r.parsed?.id;
    const slug = r.parsed?.fields.slug;
    const sku = r.parsed?.fields.sku;
    if (slug && (slugOwners ?? []).some((o) => o.slug === slug && o.id !== own)) r.errors.push(`Another product already uses the web address ${slug}.`);
    if (slug && (redirects ?? []).some((o) => o.from_slug === slug && o.product_id !== own)) r.errors.push(`The web address ${slug} still redirects to another product.`);
    if (sku && (skuOwners ?? []).some((o) => o.sku === sku && o.id !== own)) r.errors.push(`Another product already has the item code ${sku}.`);
    if (r.errors.length) {
      r.outcome = "error";
      r.parsed = null;
    }
  }
}
