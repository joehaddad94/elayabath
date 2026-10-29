// End-to-end check: the products grid against the running server.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
await admin.from("sign_in_log").delete().neq("id", 0);

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail !== "" ? "  (" + detail + ")" : ""}`);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().slice(0, 160)}`); });

await page.goto(`${BASE}/admin/sign-in`, { waitUntil: "networkidle" });
await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
const count = () => page.evaluate(() => document.querySelector("[class*=count]")?.textContent?.trim() ?? "");
const rowCount = () => page.evaluate(() => document.querySelectorAll(".ag-row").length);
await page.waitForFunction(() => /\d+ products/.test(document.querySelector("[class*=count]")?.textContent ?? ""));
check("the grid loads the catalogue count", (await count()).startsWith("596 products"), await count());
check("rows render", (await rowCount()) > 10, `${await rowCount()} rows in view`);

// scrolling loads further blocks
const blocks = [];
page.on("request", (r) => { if (r.url().includes("/api/admin/products")) blocks.push(new URL(r.url()).searchParams.get("start")); });
await page.evaluate(() => { const v = document.querySelector(".ag-body-vertical-scroll-viewport"); v.scrollTop = v.scrollHeight; });
await page.waitForTimeout(1200);
check("scrolling pages in further blocks", blocks.some((s) => Number(s) >= 100), `requested starts: ${blocks.join(",")}`);

// toolbar filters
const setToolbar = async (fn) => { await fn(); await page.waitForTimeout(900); };
await setToolbar(() => page.fill('input[placeholder="Name or item code"]', "arco"));
const arco = await count();
check("search narrows the grid", /^\d+ products/.test(arco) && !arco.startsWith("596"), arco);
await setToolbar(() => page.fill('input[placeholder="Name or item code"]', ""));
await setToolbar(() => page.check("text=Needs attention"));
check("'needs attention' finds the incomplete products", (await count()).startsWith("285"), await count());
await setToolbar(() => page.uncheck("text=Needs attention"));
const { count: hiddenCount } = await admin.from("products").select("id", { count: "exact", head: true }).eq("status", "draft");
await setToolbar(() => page.getByLabel("On the site").selectOption("draft"));
check("'hidden' finds the hidden products", (await count()).startsWith(`${hiddenCount} product`), `${await count()} vs ${hiddenCount}`);
await setToolbar(() => page.getByLabel("On the site").selectOption(""));
await setToolbar(() => page.selectOption("select >> nth=0", { label: "Toilets" }));
check("the category filter applies", (await count()).startsWith("26"), await count());
await setToolbar(() => page.selectOption("select >> nth=0", ""));

// column filter and sort, through the route the grid uses, with this session
const api = async (state) => (await (await page.request.get(`${BASE}/api/admin/products?start=0&end=5&state=${encodeURIComponent(JSON.stringify(state))}`)).json());
const f = await api({ filter: { sku: { filterType: "text", type: "startsWith", filter: "E01" } }, sort: [{ colId: "sku", sort: "asc" }] });
check("a column filter and sort run in the database", f.rows.length > 0 && f.rows.every((r) => r.sku.startsWith("E01")), `${f.lastRow} match, first ${f.rows[0]?.sku}`);
const bad = await page.request.get(`${BASE}/api/admin/products?state=${encodeURIComponent(JSON.stringify({ sort: [{ colId: "id; drop table products", sort: "asc" }] }))}`);
check("an unknown sort column is ignored, not spliced into SQL", bad.ok());
const anon = await fetch(`${BASE}/api/admin/products?start=0&end=5`);
check("the rows route refuses anyone not signed in", anon.status === 401, anon.status);

// inline edit: rename the first row
const first = (await api({ sort: [{ colId: "sku", sort: "asc" }] })).rows[0];
await page.evaluate(() => { const v = document.querySelector(".ag-body-vertical-scroll-viewport"); v.scrollTop = 0; });
await page.click('.ag-header-cell[col-id="sku"]'); await page.waitForTimeout(900);
const nameCell = page.locator(`.ag-row[row-id="${first.id}"] .ag-cell[col-id="name"]`);
await nameCell.dblclick();
await page.keyboard.press("Control+A");
await page.keyboard.type(`${first.name} TEST`);
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
const { data: renamed } = await admin.from("products").select("name, version, published_version").eq("id", first.id).single();
check("an inline edit saves", renamed.name === `${first.name} TEST`, renamed.name);
check("as one new version, with nothing left waiting", renamed.version === first.version + 1 && renamed.version === renamed.published_version, `v${first.version} -> v${renamed.version}`);
const { data: live } = await admin.from("published_products").select("name").eq("product_id", first.id).maybeSingle();
check("and goes live at once", first.status !== "active" || live?.name === `${first.name} TEST`, live?.name);

// conflict: someone else saves first
await admin.from("products").update({ dimensions: "999 x 999 mm" }).eq("id", first.id);
await nameCell.dblclick();
await page.keyboard.press("Control+A");
await page.keyboard.type("Stale edit");
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
const notice = await page.evaluate(() => document.querySelector("[role=alert]")?.textContent ?? "");
const { data: afterConflict } = await admin.from("products").select("name").eq("id", first.id).single();
check("a stale edit is refused, not saved over someone else's", afterConflict.name === `${first.name} TEST`, afterConflict.name);
check("and the editor is told who changed it", notice.includes("changed this product since you opened it"), notice.slice(0, 80));

// bulk hide and show of the ticked row, and the site follows
await page.locator(`.ag-row[row-id="${first.id}"] .ag-selection-checkbox input`).check();
await page.click("button:has-text('Hide')");
await page.waitForTimeout(2500);
check("hiding takes it off the site", (await fetch(`${BASE}/product/${first.slug}`)).status === 404);
await page.locator(`.ag-row[row-id="${first.id}"] .ag-selection-checkbox input`).check();
await page.click("button:has-text('Show on site')");
await page.waitForTimeout(2500);
const pdp = await (await fetch(`${BASE}/product/${first.slug}`)).text();
check("showing it puts it back, with the edit", pdp.includes(`${first.name} TEST`));

// palette
const bg = async () => page.evaluate(() => getComputedStyle(document.querySelector(".ag-root-wrapper")).backgroundColor);
const ink = await bg();
await page.click('button[aria-label^="Switch to the"]'); await page.waitForTimeout(400);
const stone = await bg();
check("the grid follows the palette switch", ink !== stone, `${ink} -> ${stone}`);

check("no errors in the browser console", errors.length === 0, errors[0] ?? "");

// restore the renamed product and republish it
await admin.from("products").update({ name: first.name, dimensions: first.dimensions, status: first.status }).eq("id", first.id);
await admin.rpc("publish_product", { p_id: first.id, p_note: "c6 verify restore" });
await admin.from("sign_in_log").delete().neq("id", 0);
// The data was put back directly, so refresh the site's cached pages too;
// otherwise the next run (or a person) would see what the test left.
await fetch(`${BASE}/api/admin/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => {});
await b.close();
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} passed`);
