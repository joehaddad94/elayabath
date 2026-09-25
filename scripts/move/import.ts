/**
 * A folder written by `move:export`, into an empty Supabase project: the
 * other half of moving the catalogue to a new account.
 *
 *   node --env-file=.env.target scripts/move/import.ts <folder>
 *
 * .env.target holds the new project's NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY. The new project must have had the migrations pushed
 * (`npx supabase db push`) and hold no catalogue yet: this refuses to write
 * over one, as the seed does.
 *
 * Tables go in the order their references need, ids kept, so every link,
 * version and published copy is exactly as it was; the files go back to the
 * same paths. Finally every count is checked against the export's manifest.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BUCKETS, GENERATED_ID, TABLES, pool } from "./export.ts";

const folder = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!folder || !url || !key) {
  console.error("usage: node --env-file=.env.target scripts/move/import.ts <folder>");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const manifest = JSON.parse(await fs.readFile(path.join(folder, "manifest.json"), "utf8")) as {
  source: string;
  tables: Record<string, number>;
  files: Record<string, number>;
};
if (manifest.source === new URL(url).host && !process.env.MOVE_SAME_HOST) {
  console.error(`The folder was exported from ${manifest.source}, which is also the target. Refusing.`);
  process.exit(2);
}

const { count: existing } = await db.from("products").select("id", { count: "exact", head: true });
if (existing) {
  console.error(`The target already has ${existing} products. Import only into an empty project.`);
  process.exitCode = 1;
} else {
  // The staff list guards against being emptied, and the target may hold a
  // first staff member already; the export's list is added alongside.
  for (const table of TABLES) {
    const rows = JSON.parse(await fs.readFile(path.join(folder, "tables", `${table}.json`), "utf8")) as Array<Record<string, unknown>>;
    const clean = GENERATED_ID.has(table)
      ? rows.map((row) => {
          const copy = { ...row };
          delete copy.id;
          return copy;
        })
      : rows;
    for (let i = 0; i < clean.length; i += 500) {
      const chunk = clean.slice(i, i + 500);
      const { error } =
        table === "staff" || table === "reserved_addresses"
          ? await db.from(table).upsert(chunk, { onConflict: "email", ignoreDuplicates: true })
          : table === "catalogue_meta"
            ? await db.from(table).upsert(chunk)
            : await db.from(table).insert(chunk);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`  ${table.padEnd(22)} ${clean.length}`);
  }

  for (const bucket of BUCKETS) {
    const root = path.join(folder, "storage", bucket);
    const files = await walk(root).catch(() => [] as string[]);
    await pool(files, 8, async (file) => {
      const name = path.relative(root, file).split(path.sep).join("/");
      const body = await fs.readFile(file);
      const type = name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".png") ? "image/png" : name.endsWith(".jpg") ? "image/jpeg" : "image/webp";
      const { error } = await db.storage.from(bucket).upload(name, body, { contentType: type, cacheControl: "31536000", upsert: true });
      if (error) throw new Error(`${bucket}/${name}: ${error.message}`);
    });
    console.log(`  ${bucket.padEnd(22)} ${files.length} files`);
  }

  // Every count, against what was exported.
  let wrong = 0;
  for (const table of TABLES) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true });
    const expected = manifest.tables[table] ?? 0;
    // The target's own first staff member may be on top of the exported list.
    const ok = table === "staff" ? (count ?? 0) >= expected : count === expected;
    if (!ok) {
      wrong += 1;
      console.log(`  MISMATCH ${table}: ${count} (expected ${expected})`);
    }
  }
  for (const bucket of BUCKETS) {
    const { data } = await db.rpc("storage_usage");
    const got = Number((data ?? []).find((b: { bucket_id: string }) => b.bucket_id === bucket)?.files ?? 0);
    if (got < (manifest.files[bucket] ?? 0)) {
      wrong += 1;
      console.log(`  MISMATCH ${bucket}: ${got} files (expected ${manifest.files[bucket]})`);
    }
  }
  console.log(wrong ? `\n${wrong} mismatches.` : "\nimported: every table and bucket matches the export.");
  process.exitCode = wrong ? 1 : 0;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}
