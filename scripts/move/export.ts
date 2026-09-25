/**
 * Everything a Supabase project holds for the catalogue, into one folder:
 * every table as JSON and every stored file, ready for `move:import` into
 * another project. This is how the catalogue moves from Joe's development
 * account to Elaya's own, with every edit and upload made in between.
 *
 *   node --env-file=.env.source scripts/move/export.ts <folder>
 *
 * .env.source holds the source project's NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY. Read-only: the source is not changed.
 *
 * Not carried: sign-in accounts. Staff are carried as the staff list, and
 * each signs in again on the new project, which creates their account.
 * Uploaded spreadsheets (the imports bucket) are working files and stay
 * behind; the import history itself is carried.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export const TABLES = [
  "staff",
  "reserved_addresses",
  "categories",
  "product_types",
  "finishes",
  "import_jobs",
  "products",
  "product_finishes",
  "product_images",
  "revisions",
  "published_categories",
  "published_finishes",
  "published_products",
  "catalogue_meta",
  "redirects",
  "grid_views",
  "import_rows",
  "mapping_presets",
  "sign_in_log",
] as const;

/** Tables whose ids the database generates; import lets the target assign
 *  new ones, keeping the original order. Nothing refers to these ids. */
export const GENERATED_ID = new Set(["revisions", "sign_in_log"]);

export const BUCKETS = ["product-media", "swatches", "datasheets"] as const;

/** Each table's full key, so paging through it neither repeats nor skips a
 *  row: a sort with ties can shuffle rows across page boundaries. */
const ORDER: Record<string, string[]> = {
  staff: ["email"],
  reserved_addresses: ["email"],
  product_finishes: ["product_id", "finish_id"],
  published_products: ["product_id"],
  published_categories: ["category_id"],
  published_finishes: ["finish_id"],
  redirects: ["from_slug"],
  import_rows: ["job_id", "row_number"],
};

async function main() {
  const out = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!out || !url || !key) {
    console.error("usage: node --env-file=.env.source scripts/move/export.ts <folder>");
    process.exit(2);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  await fs.mkdir(path.join(out, "tables"), { recursive: true });
  const manifest: { source: string; exportedAt: string; tables: Record<string, number>; files: Record<string, number>; bytes: number } = {
    source: new URL(url).host,
    exportedAt: new Date().toISOString(),
    tables: {},
    files: {},
    bytes: 0,
  };

  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      let query = db.from(table).select("*");
      for (const column of ORDER[table] ?? ["id"]) query = query.order(column);
      const { data, error } = await query.range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    manifest.tables[table] = rows.length;
    await fs.writeFile(path.join(out, "tables", `${table}.json`), JSON.stringify(rows));
    console.log(`  ${table.padEnd(22)} ${rows.length}`);
  }

  for (const bucket of BUCKETS) {
    const files = await listAll(db, bucket, "");
    let done = 0;
    await pool(files, 8, async (name) => {
      const { data, error } = await db.storage.from(bucket).download(name);
      if (error || !data) throw new Error(`${bucket}/${name}: ${error?.message}`);
      const target = path.join(out, "storage", bucket, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const bytes = Buffer.from(await data.arrayBuffer());
      await fs.writeFile(target, bytes);
      manifest.bytes += bytes.length;
      done += 1;
    });
    manifest.files[bucket] = done;
    console.log(`  ${bucket.padEnd(22)} ${done} files`);
  }

  await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nexported to ${out}: ${(manifest.bytes / 1024 ** 2).toFixed(1)} MB of files.`);
}

/** Every file in a bucket, folders walked. */
type Client = { storage: ReturnType<typeof createClient>["storage"] };

async function listAll(db: Client, bucket: string, prefix: string): Promise<string[]> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    for (const item of data ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) names.push(...(await listAll(db, bucket, full)));
      else names.push(full);
    }
    if ((data ?? []).length < 1000) return names;
  }
}

export async function pool<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await task(items[next++]!);
    }),
  );
}

if (import.meta.main) await main();
