// End-to-end check: export, import round trips, apply, publish, discard.
import ExcelJS from "exceljs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const omit = (row, keys) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
const BASE = process.env.BASE ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
await admin.from("sign_in_log").delete().neq("id", 0);

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail !== "" ? "  (" + detail + ")" : ""}`);
const drafts = async () => (await admin.from("admin_products").select("id", { count: "exact", head: true }).eq("has_changes", true)).count;
const draftsBefore = await drafts();

const { data: target } = await admin.from("products").select("*").eq("sku", "E01-SW10114").single();
const { data: target2 } = await admin.from("products").select("*").eq("sku", "E01-SW10001").single();
const { data: cat } = await admin.from("categories").select("name").eq("id", target.category_id).single();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 200)));
const go = (path) => page.goto(`${BASE}${path}`, { waitUntil: "load" });
const download = async (path) => Buffer.from(await (await page.request.get(`${BASE}${path}`)).body());

/** Imports a file through the page and checks it; returns the job's counts. */
async function importFile(entity, name, buffer, before) {
  await go("/admin/imports");
  await page.getByLabel("The file holds").selectOption(entity);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose a file" }).click();
  await (await chooser).setFiles({ name, mimeType: "application/octet-stream", buffer });
  await page.waitForURL("**/admin/imports/*", { timeout: 60000 });
  await page.waitForSelector("text=1. Columns and rules");
  if (before) await before();
  await page.getByRole("button", { name: /^Check the rows/ }).click();
  await page.waitForSelector("text=2. What it changes", { timeout: 120000 });
  const id = page.url().split("/").pop();
  const { data: job } = await admin.from("import_jobs").select("id, counts, status").eq("id", id).single();
  return job;
}

try {
  await go("/admin/sign-in");
  await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

  // ── exports ──
  const template = await download("/api/admin/export?entity=products&format=csv&scope=template");
  check("a blank template is just the headers", template.toString("utf8").replace(/^﻿/, "").trim().split("\r\n").length === 1, template.toString("utf8").trim().slice(1, 80));
  const all = await download("/api/admin/export?entity=products&format=xlsx");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(all);
  check("every product exports to Excel", wb.worksheets[0].rowCount === 597, `${wb.worksheets[0].rowCount - 1} rows`);
  const anon = await fetch(`${BASE}/api/admin/export?entity=products&format=csv`);
  check("exports are staff only", anon.status === 403 || anon.status === 401, anon.status);

  // From the grid: this view, with its columns.
  await go("/admin/products");
  await page.fill('input[placeholder="Name or item code"]', "arco");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Export" }).click();
  const [viewFile] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /This view, CSV/ }).click()]);
  const viewCsv = (await (await viewFile.createReadStream()).toArray()).join("");
  const viewLines = viewCsv.replace(/^﻿/, "").trim().split("\r\n");
  check("the grid exports its current view, each column once", viewLines.length === 9 && viewLines[0].split(",").filter((h) => h === "Item code").length === 1, `${viewLines.length - 1} rows; headers ${viewLines[0].slice(0, 70)}`);

  // ── round trips: an export imports back as no change at all ──
  const productsJob = await importFile("products", "products.xlsx", all);
  check("a product export imports back with nothing to change", productsJob.counts.unchanged === 596 && !productsJob.counts.error && !productsJob.counts.changed && !productsJob.counts.new, JSON.stringify(productsJob.counts));
  for (const entity of ["categories", "finishes", "product_finishes"]) {
    const file = await download(`/api/admin/export?entity=${entity}&format=csv`);
    const job = await importFile(entity, `${entity}.csv`, file);
    check(`a ${entity.replace("_", " ")} export imports back unchanged`, !job.counts.error && !job.counts.changed && !job.counts.new && job.counts.unchanged > 0, JSON.stringify(job.counts));
  }

  // ── a sheet with a change, a new product, and two mistakes ──
  const csv = [
    "Item code,Name,Category,Dimensions,Finishes",
    `${target.sku},,,999 x 111 mm,`,
    `C11-NEW-1,C11 new basin,${cat.name},500 x 400 mm,`,
    `C11-NEW-2,Wrong category,No such category,,`,
    `${target.sku},,,888 x 111 mm,`,
    `${target2.sku},,,,P08`,
  ].join("\r\n");
  const mixed = await importFile("products", "mixed.csv", Buffer.from(csv));
  check("a change and a new product are found", mixed.counts.changed === 1 && mixed.counts.new === 1, JSON.stringify(mixed.counts));
  check("an unknown category, a repeated code and an ambiguous finish code are errors", mixed.counts.error === 3);
  await page.getByRole("button", { name: "Errors", exact: true }).click();
  await page.waitForTimeout(800);
  const problems = await page.locator(".ag-root-wrapper").textContent();
  check("the preview filters to the errors, with reasons", /No category called/.test(problems) && /also appears on row 2/.test(problems) && /P08 belongs to/.test(problems), problems.slice(0, 120));

  // Someone edits the product between the check and the apply.
  await admin.from("products").update({ description: target.description + " " }).eq("id", target.id);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^Apply 2 changes/ }).click();
  await page.waitForSelector("text=3. Publish or discard", { timeout: 60000 });
  const { data: t1 } = await admin.from("products").select("dimensions").eq("id", target.id).single();
  check("a row changed after the check is left alone, not overwritten", t1.dimensions === target.dimensions, t1.dimensions);
  const { data: fresh } = await admin.from("products").select("id, status, import_job_id").eq("sku", "C11-NEW-1").single();
  check("the new product is created as a draft, tagged with the import", fresh.status === "draft" && fresh.import_job_id === mixed.id);
  check("and the site is unchanged", (await fetch(`${BASE}/product/c11-new-1`)).status === 404);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publish everything from this import" }).click();
  await page.waitForSelector("text=Published. The site shows everything this import changed.", { timeout: 60000 });
  check("publishing the import puts it live", (await fetch(`${BASE}/product/c11-new-1`)).status === 200);

  // ── discard: an import of changes to live products, undone ──
  await admin.from("products").update({ description: target.description }).eq("id", target.id);
  await admin.rpc("publish_product", { p_id: target.id, p_note: "c11 verify" });
  const change = ["Item code,Dimensions,Featured", `${target.sku},777 x 111 mm,Yes`, `${target2.sku},666 x 111 mm,`].join("\r\n");
  await importFile("products", "discard.csv", Buffer.from(change));
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^Apply 2 changes/ }).click();
  await page.waitForSelector("text=3. Publish or discard", { timeout: 60000 });
  const { data: t2 } = await admin.from("products").select("dimensions, featured").eq("id", target.id).single();
  check("the changes are applied as drafts", t2.dimensions === "777 x 111 mm" && t2.featured === true);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Discard this import's drafts" }).click();
  await page.waitForSelector("text=Discarded.", { timeout: 60000 });
  const { data: t3 } = await admin.from("admin_products").select("dimensions, featured, has_changes").eq("id", target.id).single();
  check("discarding puts them back exactly as live", t3.dimensions === target.dimensions && t3.featured === target.featured && t3.has_changes === false, JSON.stringify(t3));
  check("no products are left with unpublished changes by the imports", (await drafts()) === draftsBefore, `${await drafts()} vs ${draftsBefore}`);

  // A saved mapping maps the next file by itself.
  await go("/admin/imports");
  const oddHeaders = ["Ref,Size", `${target.sku},123 x 45 mm`].join("\r\n");
  await importFile("products", "preset.csv", Buffer.from(oddHeaders), async () => {
    await page.getByLabel("Field for Ref").selectOption("sku");
    await page.getByLabel("Field for Size").selectOption("dimensions");
    await page.getByPlaceholder("optional name").fill("C11 preset");
  });
  await importFile("products", "preset2.csv", Buffer.from(oddHeaders));
  const again = page.url().split("/").pop();
  const { data: remembered } = await admin.from("import_jobs").select("mapping").eq("id", again).single();
  check("a saved mapping maps a matching file by itself", remembered.mapping.preset === "C11 preset" && Object.values(remembered.mapping.columns).includes("dimensions"));

  await page.setViewportSize({ width: 390, height: 844 });
  await go(`/admin/imports/${mixed.id}`);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("the import screens fit a phone", over <= 0, `${over}px over`);
  check("no errors in the browser console", errors.length === 0, errors[0] ?? "");
} catch (e) {
  results.push(`FAIL stopped: ${e.message.split("\n")[0]}`);
  await page.screenshot({ path: process.env.SHOT ?? "e2e-fail.png" }).catch(() => {});
} finally {
  const { data: made } = await admin.from("products").select("id").like("sku", "C11-%");
  for (const p of made ?? []) {
    await admin.from("published_products").delete().eq("product_id", p.id);
    await admin.from("revisions").delete().eq("entity_id", p.id);
    await admin.from("products").delete().eq("id", p.id);
  }
  for (const original of [target, target2]) {
    const id = original.id;
    const fields = omit(original, ["id", "version", "published_version", "created_at", "updated_at", "updated_by", "import_job_id"]);
    await admin.from("products").update({ ...fields, import_job_id: null }).eq("id", id);
    await admin.rpc("publish_product", { p_id: id, p_note: "c11 verify restore" });
  }
  await admin.from("mapping_presets").delete().eq("name", "C11 preset");
  const { data: jobs } = await admin.from("import_jobs").select("id, file_path");
  if (jobs?.length) {
    await admin.storage.from("imports").remove(jobs.map((j) => j.file_path));
    await admin.from("import_jobs").delete().in("id", jobs.map((j) => j.id));
  }
  await admin.from("sign_in_log").delete().neq("id", 0);
  // The data was put back directly, so refresh the site's cached pages too;
  // otherwise the next run (or a person) would see what the test left.
  await fetch(`${BASE}/api/admin/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => {});
  await b.close();
}
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} passed`);
