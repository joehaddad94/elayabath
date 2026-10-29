"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchAll } from "@/lib/admin/fetch-all";
import { DEFAULT_OPTIONS, FIELDS, IDENTITIES, suggestMapping, type Entity, type ImportOptions } from "@/lib/admin/import-fields";
import { stageRows, type Job } from "@/lib/admin/import-stage";
import { publishCategory, publishFinish, syncProducts } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";
import { MAX_IMPORT_ROWS, readSheet } from "@/lib/admin/sheet-reader";
import { normaliseHeader } from "@/lib/admin/sheets";

const ENTITIES = ["products", "categories", "finishes", "product_finishes"] as const;
// Each chunk's item codes are looked up in one request, whose URL carries
// them all; 200 keeps it well inside what the API accepts.
const STAGE_CHUNK = 200;
const APPLY_CHUNK = 200;
const PUBLISH_CHUNK = 60;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Starts an import from a file the browser has already put in the private
 * imports bucket: reads it once, stores its rows as they are, and suggests
 * a mapping from its headers (or from a saved preset that fits them).
 */
export async function startImport(input: { entity: string; path: string; fileName: string }): Promise<Result<{ id: string }>> {
  const { supabase } = await requireStaff();
  const entity = z.enum(ENTITIES).safeParse(input.entity);
  if (!entity.success) return { ok: false, error: "Choose what the file holds." };
  if (!/^jobs\/[0-9a-f-]{36}\/[^/]+$/.test(input.path)) return { ok: false, error: "That upload isn't valid. Upload it again." };

  const { data: file, error: downloadError } = await supabase.storage.from("imports").download(input.path);
  if (downloadError || !file) return { ok: false, error: "The file couldn't be read back from storage. Upload it again." };

  let rows: string[][];
  try {
    rows = await readSheet(await file.arrayBuffer(), input.fileName);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The file couldn't be read." };
  }
  const [headers, ...body] = rows;
  if (!headers || body.length === 0) return { ok: false, error: "The file has no rows under its headers." };
  if (body.length > MAX_IMPORT_ROWS) return { ok: false, error: `The file has ${body.length.toLocaleString("en")} rows; the limit is ${MAX_IMPORT_ROWS.toLocaleString("en")}. Split it in two.` };

  // A preset whose headers are all in this file maps it the same way again.
  const { data: presets } = await supabase.from("mapping_presets").select("name, mapping").eq("entity", entity.data);
  const present = new Set(headers.map(normaliseHeader));
  const preset = (presets ?? []).find((p) => Object.keys(p.mapping as Record<string, string>).every((h) => present.has(h)));
  const columns = preset
    ? Object.fromEntries(
        headers.flatMap((h, i) => {
          const key = (preset.mapping as Record<string, string>)[normaliseHeader(h)];
          return key ? [[String(i), key]] : [];
        }),
      )
    : suggestMapping(entity.data, headers, normaliseHeader);

  const { data: job, error } = await supabase
    .from("import_jobs")
    .insert({
      entity: entity.data,
      file_path: input.path,
      file_name: input.fileName.slice(0, 200),
      mapping: { headers, columns, preset: preset?.name ?? null },
      options: DEFAULT_OPTIONS(entity.data) as never,
      status: "uploaded",
      counts: { total: body.length },
    })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: "The import couldn't be started. Try again." };

  for (let i = 0; i < body.length; i += 1000) {
    const { error: rowError } = await supabase
      .from("import_rows")
      .insert(body.slice(i, i + 1000).map((raw, j) => ({ job_id: job.id, row_number: i + j + 2, raw })));
    if (rowError) {
      await supabase.from("import_jobs").update({ status: "failed", error: rowError.message }).eq("id", job.id);
      return { ok: false, error: "The rows couldn't be stored. Try again." };
    }
  }
  revalidatePath("/admin/imports");
  return { ok: true, id: job.id };
}

const optionsSchema = z.object({
  identity: z.string(),
  blanks: z.enum(["keep", "clear"]),
  unknown: z.enum(["create", "skip"]),
});

/**
 * Saves the mapping and the rules, optionally as a named preset, and clears
 * any earlier staging so the rows are checked again under the new rules.
 */
export async function configureImport(input: {
  id: string;
  columns: Record<string, string>;
  options: ImportOptions;
  presetName?: string;
}): Promise<Result> {
  const { supabase } = await requireStaff();
  const { data: job } = await supabase.from("import_jobs").select("id, entity, mapping, status").eq("id", input.id).maybeSingle();
  if (!job) return { ok: false, error: "This import no longer exists." };
  if (!["uploaded", "staging", "staged"].includes(job.status)) return { ok: false, error: "This import has been applied; start a new one to change its mapping." };
  const entity = job.entity as Entity;

  const options = optionsSchema.safeParse(input.options);
  if (!options.success || !IDENTITIES[entity].some((i) => i.key === options.data.identity)) return { ok: false, error: "Those rules aren't valid." };
  const known = new Set(FIELDS[entity].map((f) => f.key));
  const columns = Object.fromEntries(Object.entries(input.columns).filter(([i, key]) => /^\d+$/.test(i) && known.has(key)));
  const mapped = new Set(Object.values(columns));
  if (mapped.size !== Object.values(columns).length) return { ok: false, error: "Two columns are mapped to the same field." };
  if (!mapped.has(options.data.identity)) {
    return { ok: false, error: `Map a column to ${FIELDS[entity].find((f) => f.key === options.data.identity)?.label}: it is what finds each row.` };
  }
  if (entity === "product_finishes" && !mapped.has("finish")) return { ok: false, error: "Map a column to Finish." };

  const { headers, preset: usedPreset } = job.mapping as { headers: string[]; preset: string | null };
  if (input.presetName?.trim()) {
    const mapping = Object.fromEntries(Object.entries(columns).map(([i, key]) => [normaliseHeader(headers[Number(i)] ?? ""), key]));
    await supabase.from("mapping_presets").upsert({ entity, name: input.presetName.trim().slice(0, 60), mapping }, { onConflict: "entity,name" });
  }

  await supabase
    .from("import_jobs")
    .update({ mapping: { headers, columns, preset: input.presetName?.trim() || usedPreset || null }, options: options.data, status: "staging", counts: { total: (await countRows(supabase, input.id)) } })
    .eq("id", input.id);
  await supabase.from("import_rows").update({ outcome: null, parsed: null, diff: null, errors: [], key: null, base_version: null }).eq("job_id", input.id);
  return { ok: true };
}

async function countRows(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], id: string) {
  const { count } = await supabase.from("import_rows").select("row_number", { count: "exact", head: true }).eq("job_id", id);
  return count ?? 0;
}

/**
 * Checks the next chunk of rows. Called repeatedly by the page until nothing
 * is left, so no single request runs long whatever the file's size.
 */
export async function stageNext(input: { id: string }): Promise<Result<{ checked: number; total: number }>> {
  const { supabase } = await requireStaff();
  const { data: job } = await supabase.from("import_jobs").select("id, entity, mapping, options, status, counts").eq("id", input.id).maybeSingle();
  if (!job || job.status !== "staging") return { ok: false, error: "This import isn't waiting to be checked." };
  const mapping = job.mapping as { headers: string[]; columns: Record<string, string>; grouped?: boolean };
  const staging: Job = { id: job.id, entity: job.entity as Entity, columns: mapping.columns, options: job.options as unknown as ImportOptions };

  // Links arrive one row per product and finish; they are grouped into one
  // row per product first, so a product's finish list is replaced whole.
  if (staging.entity === "product_finishes" && !mapping.grouped) {
    const grouped = await groupLinks(supabase, staging);
    staging.columns = grouped;
  }

  const { data: rows } = await supabase
    .from("import_rows")
    .select("row_number, raw")
    .eq("job_id", job.id)
    .is("outcome", null)
    .order("row_number")
    .limit(STAGE_CHUNK);
  const staged = await stageRows(supabase, staging, (rows ?? []).map((r) => ({ row_number: r.row_number, raw: r.raw as string[] })));

  // The same item code (or address) twice in one file: the later row is
  // an error, since which one is meant can't be known.
  const keys = staged.map((r) => r.key).filter((k): k is string => Boolean(k));
  const earlier = new Map<string, number>();
  if (keys.length) {
    const { data: seen } = await supabase.from("import_rows").select("key, row_number").eq("job_id", job.id).in("key", keys);
    for (const s of seen ?? []) if (s.key) earlier.set(s.key, Math.min(earlier.get(s.key) ?? Infinity, s.row_number));
  }
  for (const r of staged) {
    if (!r.key) continue;
    const first = earlier.get(r.key);
    if (first !== undefined && first < r.row_number) {
      r.outcome = "error";
      r.errors = [...r.errors, `This also appears on row ${first}; only one row per ${r.key} is allowed.`];
      r.parsed = null;
    } else earlier.set(r.key, r.row_number);
  }

  const raw = new Map((rows ?? []).map((r) => [r.row_number, r.raw]));
  const { error: saveError } = await supabase.from("import_rows").upsert(
    staged.map((r) => ({
      job_id: job.id,
      row_number: r.row_number,
      raw: raw.get(r.row_number) ?? [],
      outcome: r.outcome,
      parsed: r.parsed as never,
      diff: r.diff as never,
      errors: r.errors,
      key: r.key,
      base_version: r.base_version,
    })),
    { onConflict: "job_id,row_number" },
  );
  if (saveError) return { ok: false, error: `Checking stopped: ${saveError.message}` };

  const total = await countRows(supabase, job.id);
  const { count: left } = await supabase.from("import_rows").select("row_number", { count: "exact", head: true }).eq("job_id", job.id).is("outcome", null);
  if (!left) await finishStaging(supabase, job.id, total);
  return { ok: true, checked: total - (left ?? 0), total };
}

async function groupLinks(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], job: Job): Promise<Record<string, string>> {
  const skuCol = Number(Object.entries(job.columns).find(([, k]) => k === "sku")![0]);
  const finishCol = Number(Object.entries(job.columns).find(([, k]) => k === "finish")![0]);
  const rows = await fetchAll((from, to) =>
    supabase.from("import_rows").select("row_number, raw").eq("job_id", job.id).order("row_number").range(from, to),
  );
  const groups = new Map<string, { first: number; finishes: string[] }>();
  for (const r of rows) {
    const raw = r.raw as string[];
    const sku = (raw[skuCol] ?? "").trim();
    const finish = (raw[finishCol] ?? "").trim();
    const g = groups.get(sku) ?? { first: r.row_number, finishes: [] };
    if (finish) g.finishes.push(finish);
    groups.set(sku, g);
  }
  await supabase.from("import_rows").delete().eq("job_id", job.id);
  const grouped = [...groups].map(([sku, g]) => ({ job_id: job.id, row_number: g.first, raw: [sku, g.finishes.join(" | ")] }));
  for (let i = 0; i < grouped.length; i += 1000) await supabase.from("import_rows").insert(grouped.slice(i, i + 1000));
  const columns = { "0": "sku", "1": "finish" };
  const { data } = await supabase.from("import_jobs").select("mapping").eq("id", job.id).single();
  await supabase
    .from("import_jobs")
    .update({ mapping: { ...(data?.mapping as object), columns, grouped: true, links: rows.length } })
    .eq("id", job.id);
  return columns;
}

async function finishStaging(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], id: string, total: number) {
  const counts: Record<string, number> = { total };
  for (const outcome of ["new", "changed", "unchanged", "skipped", "error"]) {
    const { count } = await supabase.from("import_rows").select("row_number", { count: "exact", head: true }).eq("job_id", id).eq("outcome", outcome);
    counts[outcome] = count ?? 0;
  }
  await supabase.from("import_jobs").update({ status: "staged", counts }).eq("id", id);
}

/** Applies the next batch of checked rows as drafts, in one transaction. */
export async function applyNext(input: { id: string }): Promise<Result<{ remaining: number; refused: number }>> {
  const { supabase } = await requireStaff();
  const { data: job } = await supabase.from("import_jobs").select("status, counts").eq("id", input.id).maybeSingle();
  if (!job || !["staged", "applying"].includes(job.status)) return { ok: false, error: "This import isn't ready to apply." };
  const { data, error } = await supabase.rpc("apply_import", { p_job: input.id, p_limit: APPLY_CHUNK });
  if (error) return { ok: false, error: `Applying stopped: ${error.message}` };
  const result = data as { applied: number; refused: number; remaining: number };
  if (result.remaining === 0) {
    const { count } = await supabase.from("import_rows").select("row_number", { count: "exact", head: true }).eq("job_id", input.id).eq("outcome", "error");
    await supabase.from("import_jobs").update({ counts: { ...(job.counts as object), error: count ?? 0 } }).eq("id", input.id);
    revalidatePath("/admin/imports");
  }
  return { ok: true, remaining: result.remaining, refused: result.refused };
}

/**
 * Publishes what the import changed, a batch at a time. Products carry the
 * import's tag until published, so the next batch is simply the ones still
 * tagged; categories and finishes are the rows the import wrote.
 */
export async function publishNext(input: { id: string }): Promise<Result<{ remaining: number }>> {
  const { supabase } = await requireStaff();
  const { data: job } = await supabase.from("import_jobs").select("entity, status").eq("id", input.id).maybeSingle();
  if (!job || !["applied", "published"].includes(job.status)) return { ok: false, error: "Apply the import before publishing it." };

  if (job.entity === "products" || job.entity === "product_finishes") {
    const { data: batch } = await supabase.from("products").select("id").eq("import_job_id", input.id).limit(PUBLISH_CHUNK);
    const ids = (batch ?? []).map((p) => p.id);
    if (ids.length) {
      const { failed } = await syncProducts(supabase, ids, "Published from an import");
      if (failed.length) return { ok: false, error: `${failed.length} couldn't be published: ${failed[0]!.message}` };
    }
    const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("import_job_id", input.id);
    if (!count) await supabase.from("import_jobs").update({ status: "published" }).eq("id", input.id);
    return { ok: true, remaining: count ?? 0 };
  }

  const targets = await fetchAll((from, to) =>
    supabase.from("import_rows").select("target_id").eq("job_id", input.id).eq("applied", true).in("outcome", ["new", "changed"]).range(from, to),
  );
  for (const t of targets) {
    if (!t.target_id) continue;
    const { error } = job.entity === "categories" ? await publishCategory(supabase, t.target_id, "Published from an import") : await publishFinish(supabase, t.target_id, "Published from an import");
    if (error) return { ok: false, error };
  }
  await supabase.from("import_jobs").update({ status: "published" }).eq("id", input.id);
  return { ok: true, remaining: 0 };
}

/** Undoes the import's unpublished drafts: new rows deleted, changed rows
 *  back to their live version. */
export async function discardImport(input: { id: string }): Promise<Result<{ deleted: number; reverted: number }>> {
  const { supabase } = await requireStaff();
  const { data: job } = await supabase.from("import_jobs").select("status").eq("id", input.id).maybeSingle();
  if (!job || !["applied", "applying"].includes(job.status)) return { ok: false, error: "Only an applied, unpublished import can be discarded." };
  const { data, error } = await supabase.rpc("discard_import", { p_job: input.id });
  if (error) return { ok: false, error: `Discarding stopped: ${error.message}` };
  revalidatePath("/admin/imports");
  return { ok: true, ...(data as { deleted: number; reverted: number }) };
}

export async function deletePreset(input: { entity: string; name: string }): Promise<Result> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("mapping_presets").delete().eq("entity", input.entity).eq("name", input.name);
  return error ? { ok: false, error: "It couldn't be deleted." } : { ok: true };
}
