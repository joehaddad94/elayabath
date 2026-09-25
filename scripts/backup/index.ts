/**
 * Every table -> JSON files, for the nightly backup.
 *
 *   node --env-file-if-exists=.env.local scripts/backup/index.ts <out-dir>
 *
 * Run nightly by .github/workflows/catalogue-backup.yml, which commits the
 * output to the `catalogue-backup` branch. Two jobs in one: the free tier has
 * no backups, and it pauses a project after a week without activity; this
 * query every night is activity.
 *
 * No dependencies, only fetch against the REST API, so the job does not
 * install the project to run. Output is sorted and stable, so a night with
 * no edits produces no commit and a night with some produces a readable diff.
 *
 * Not included: the files in Storage. Rows keep their paths; the seeded
 * files can be rebuilt from the scrape, but uploads made in the dashboard
 * are only in Storage. See "Safeguards on the free tier" in CMS-PLAN.md.
 */
import fs from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const out = process.argv[2];

if (!url || !key || !out) {
  console.error("usage: SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup/index.ts <out-dir>");
  process.exit(2);
}

/** Each table with the columns that order it stably. */
const TABLES: Record<string, string> = {
  staff: "email",
  reserved_addresses: "email",
  sign_in_log: "id",
  categories: "id",
  product_types: "id",
  finishes: "id",
  products: "id",
  product_finishes: "product_id,finish_id",
  product_images: "id",
  revisions: "id",
  published_products: "product_id",
  published_categories: "category_id",
  published_finishes: "finish_id",
  catalogue_meta: "id",
  redirects: "from_slug",
  grid_views: "id",
  import_jobs: "id",
  import_rows: "job_id,row_number",
  mapping_presets: "id",
};

const PAGE = 1000;

async function readAll(table: string, order: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=*&order=${order}&limit=${PAGE}&offset=${offset}`,
      { headers: { apikey: key!, accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    }
    const page = (await response.json()) as unknown[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

await fs.mkdir(out, { recursive: true });
const counts: Record<string, number> = {};

for (const [table, order] of Object.entries(TABLES)) {
  const rows = await readAll(table, order);
  counts[table] = rows.length;
  await fs.writeFile(path.join(out, `${table}.json`), `${JSON.stringify(rows, null, 1)}\n`);
}

// The published catalogue on its own, in the site's shapes: what the public
// site would need to build from a snapshot if the database were unreachable.
const published = JSON.parse(await fs.readFile(path.join(out, "published_products.json"), "utf8")) as Array<{
  snapshot: unknown;
}>;
await fs.writeFile(
  path.join(out, "catalogue.json"),
  `${JSON.stringify(published.map((row) => row.snapshot), null, 1)}\n`,
);

// Counts only, no timestamp: a timestamp would make every night a commit.
await fs.writeFile(path.join(out, "manifest.json"), `${JSON.stringify(counts, null, 1)}\n`);

console.log(Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(" "));
