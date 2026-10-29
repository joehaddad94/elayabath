/**
 * Load test at ten times the catalogue, against the local stack.
 *
 *   npm run build && npm start        # in one terminal
 *   npm run load                      # in another
 *
 * Imports 6,000 new products through the real import screens (upload,
 * check, apply), times each stage, then times the grid's heaviest queries
 * and the public shelf and search against 6,596 products, publishes a
 * sample batch, and removes everything it made. Local only: it refuses to
 * run against anything but localhost.
 */
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL_) || !/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error("The load test only runs against the local stack.");
  process.exit(2);
}
const ROWS = Number(process.env.LOAD_ROWS ?? 6000);
const db = createClient(URL_, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

type Page = {
  goto: (u: string, o?: unknown) => Promise<unknown>;
  fill: (s: string, v: string) => Promise<void>;
  click: (s: string) => Promise<void>;
  waitForURL: (u: string, o?: unknown) => Promise<void>;
  waitForSelector: (s: string, o?: unknown) => Promise<unknown>;
  waitForEvent: (e: string) => Promise<{ setFiles: (f: unknown) => Promise<void> }>;
  getByLabel: (l: string) => { selectOption: (v: string) => Promise<void> };
  getByRole: (r: string, o: unknown) => { click: () => Promise<void> };
  once: (e: string, f: (d: { accept: () => Promise<void> }) => void) => void;
  url: () => string;
  request: { get: (u: string) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }> };
};
const specifier = "playwright";
const { chromium } = (await import(specifier)) as { chromium: { launch: () => Promise<{ newContext: (o?: unknown) => Promise<{ newPage: () => Promise<Page> }>; close: () => Promise<void> }> } };

const timings: Array<[string, number]> = [];
const time = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  const out = await fn();
  timings.push([label, performance.now() - start]);
  return out;
};

const { data: categories } = await db.from("categories").select("name").eq("status", "active");
const names = (categories ?? []).map((c) => c.name);
const lines = ["Item code,Name,Category,Dimensions,Description"];
for (let i = 1; i <= ROWS; i++) {
  const n = String(i).padStart(5, "0");
  lines.push(`LOAD-${n},Load test ${n},${names[i % names.length]},${400 + (i % 300)} x ${300 + (i % 200)} mm,Synthetic product ${n} for the load test.`);
}
const csv = Buffer.from(lines.join("\r\n"));

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
let jobId = "";
try {
  await page.goto(`${BASE}/admin/sign-in`);
  await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL!);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

  // ── import ──
  await page.goto(`${BASE}/admin/imports`);
  await page.getByLabel("The file holds").selectOption("products");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose a file" }).click();
  await time("upload and read the file", async () => {
    await (await chooser).setFiles({ name: "load.csv", mimeType: "text/csv", buffer: csv });
    await page.waitForURL("**/admin/imports/*", { timeout: 300_000 });
  });
  jobId = page.url().split("/").pop()!;
  await page.waitForSelector("text=1. Columns and rules");
  await time(`check ${ROWS.toLocaleString("en")} rows`, async () => {
    await page.getByRole("button", { name: "Check the rows" }).click();
    await page.waitForSelector("text=2. What it changes", { timeout: 600_000 });
  });
  const { data: staged } = await db.from("import_jobs").select("counts").eq("id", jobId).single();
  console.log("  checked:", JSON.stringify(staged?.counts));
  await time(`apply ${ROWS.toLocaleString("en")} rows as drafts`, async () => {
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: /^Apply / }).click();
    await page.waitForSelector("text=3. Publish or discard", { timeout: 600_000 });
  });

  // ── the grid and the site at ten times the catalogue ──
  const { count } = await db.from("products").select("id", { count: "exact", head: true });
  console.log(`  products in the working copy: ${count}`);
  const grid = async (label: string, start: number, state: object) =>
    time(`grid: ${label}`, async () => {
      const r = await page.request.get(`${BASE}/api/admin/products?start=${start}&end=${start + 100}&state=${encodeURIComponent(JSON.stringify(state))}`);
      if (!r.ok()) throw new Error(`grid ${label} failed`);
    });
  await grid("first block", 0, {});
  await grid("sorted by name", 0, { sort: [{ colId: "name", sort: "asc" }] });
  await grid("block at row 6,000", 6000, {});
  await grid("search", 0, { q: "load test 04" });
  await grid("needs attention", 0, { incomplete: true });
  await grid("column filter", 0, { filter: { dimensions: { filterType: "text", type: "contains", filter: "450" } } });

  // Publishing, in the database, for a sample: the per-product cost behind
  // the import page's "Publish everything" batches.
  const { data: sample } = await db.from("products").select("id").eq("import_job_id", jobId).limit(120);
  await time("publish 120 products in the database", async () => {
    for (const p of sample ?? []) await db.rpc("publish_product", { p_id: p.id, p_note: "load test" });
  });
  await time("public shelf, first page", async () => void (await fetch(`${BASE}/api/shelf?category=${encodeURIComponent("washbasins")}`)));
  await time("public search", async () => void (await fetch(`${BASE}/api/search?q=load`)));
} finally {
  // ── remove everything the test made ──
  await time("clean up", async () => {
    const ids: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("products").select("id").like("sku", "LOAD-%").range(from, from + 999);
      ids.push(...(data ?? []).map((p) => p.id));
      if ((data ?? []).length < 1000) break;
    }
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      await db.from("revisions").delete().eq("entity_type", "product").in("entity_id", chunk);
      await db.from("products").delete().in("id", chunk);
    }
    if (jobId) {
      const { data: job } = await db.from("import_jobs").select("file_path").eq("id", jobId).single();
      if (job) await db.storage.from("imports").remove([job.file_path]);
      await db.from("import_jobs").delete().eq("id", jobId);
    }
  });
  await browser.close();
}

console.log(`\nLoad test at ${ROWS.toLocaleString("en")} imported rows:`);
for (const [label, ms] of timings) console.log(`  ${label.padEnd(46)} ${ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`}`);
