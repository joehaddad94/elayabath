// End-to-end check: preview and the sitemap.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const omit = (row, keys) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
const BASE = process.env.BASE ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
await admin.from("sign_in_log").delete().neq("id", 0);

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail !== "" ? "  (" + detail + ")" : ""}`);

const { data: ace } = await admin.from("products").select("*").eq("sku", "E02-SW20001").single();
const { data: other } = await admin.from("products").select("*").eq("sku", "E01-SW10114").single();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 200)));
const editor = (id) => page.goto(`${BASE}/admin/products/${id}`, { waitUntil: "load" }).then(() => page.waitForSelector("fieldset"));
const saveNow = async () => {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForSelector("text=/^Saved\\./");
};

try {
  await page.goto(`${BASE}/admin/sign-in`, { waitUntil: "load" });
  await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

  // ── preview ──
  // A hidden product can be previewed by staff; visitors get a 404.
  await page.goto(`${BASE}/admin/products/new`, { waitUntil: "load" });
  await page.getByLabel("Item code").fill("C9-TEST-0001");
  await page.getByLabel("Name").fill("Preview test");
  await page.getByLabel("Category").selectOption(ace.category_id);
  await Promise.all([page.waitForURL("**/admin/products/*?created=1"), page.click("button:has-text('Create product, hidden')")]);
  const newId = page.url().split("/").pop().split("?")[0];
  await page.getByLabel("Description").fill("C9 hidden description.");
  check("preview waits for a save", (await page.getByText("save first to see these changes").count()) === 1);
  await saveNow();
  const previewResponse = await page.goto(`${BASE}/admin/preview?product=${newId}`, { waitUntil: "load" });
  check("preview opens the real product page", new URL(page.url()).pathname === "/product/c9-test-0001");
  check(
    "showing the saved copy, under a preview banner",
    (await page.content()).includes("C9 hidden description.") && (await page.getByText("The saved copy, shown only to staff").count()) === 1,
  );
  check("sent as private and not for indexing", /no-store/.test(previewResponse.headers()["cache-control"] ?? "") && /noindex/.test(previewResponse.headers()["x-robots-tag"] ?? ""), previewResponse.headers()["cache-control"]);
  check("while visitors get a 404", (await fetch(`${BASE}/product/c9-test-0001`)).status === 404);

  const bypass = (await ctx.cookies()).find((c) => c.name === "__prerender_bypass");
  const stranger = await b.newContext();
  await stranger.addCookies([{ ...bypass }]);
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(`${BASE}/product/c9-test-0001`, { waitUntil: "load" });
  check("a copied preview cookie without a staff session shows nothing", !(await strangerPage.content()).includes("C9 hidden description."));
  await stranger.close();

  await Promise.all([page.waitForURL(`**/admin/products/${newId}`), page.getByRole("button", { name: "Leave preview" }).click()]);
  check("leaving preview returns to the editor and ends preview", !(await ctx.cookies()).some((c) => c.name === "__prerender_bypass"));

  // ── sitemap ──
  const inSitemap = async () => (await (await fetch(`${BASE}/sitemap.xml`)).text()).includes(`/product/${other.slug}<`);
  check("a live product is in the sitemap", await inSitemap());
  await editor(other.id);
  await page.getByLabel("Hidden: not on the site at all").check();
  await saveNow();
  check("hiding it takes it out of the sitemap", !(await inSitemap()));
  await page.getByLabel("Visible", { exact: true }).check();
  await saveNow();
  check("and showing it again puts it back", await inSitemap());

  check("no errors in the browser console", errors.length === 0, errors[0] ?? "");
} catch (e) {
  results.push(`FAIL stopped: ${e.message.split("\n")[0]}`);
  await page.screenshot({ path: process.env.SHOT ?? "e2e-fail.png" }).catch(() => {});
} finally {
  await admin.from("products").delete().eq("sku", "C9-TEST-0001");
  for (const original of [ace, other]) {
    const id = original.id;
    const fields = omit(original, ["id", "version", "published_version", "created_at", "updated_at", "updated_by", "import_job_id"]);
    await admin.from("products").update(fields).eq("id", id);
    await admin.rpc("publish_product", { p_id: id, p_note: "c9 verify restore" });
  }
  await admin.from("sign_in_log").delete().neq("id", 0);
  // The data was put back directly, so refresh the site's cached pages too;
  // otherwise the next run (or a person) would see what the test left.
  await fetch(`${BASE}/api/admin/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => {});
  await b.close();
}
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} passed`);
