// End-to-end check: preview, history and restore, activity, sitemap.
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
const publishNow = async () => {
  await page.getByRole("button", { name: /^(Save and publish|Publish)$/ }).click();
  await page.waitForSelector("text=/Published\\./");
};

try {
  await page.goto(`${BASE}/admin/sign-in`, { waitUntil: "load" });
  await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

  // ── preview ──
  await editor(ace.id);
  await page.getByLabel("Description").fill("C9 draft description.");
  check("preview waits for a save", (await page.getByText("save first to see these changes").count()) === 1);
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForSelector("text=Saved as a draft");
  const previewResponse = await page.goto(`${BASE}/admin/preview?product=${ace.id}`, { waitUntil: "load" });
  check("preview opens the real product page", new URL(page.url()).pathname === `/product/${ace.slug}`);
  const previewHtml = await page.content();
  check("showing the saved draft, under a preview banner", previewHtml.includes("C9 draft description.") && (await page.getByText("This is the saved draft").count()) === 1);
  check("sent as private and not for indexing", /no-store/.test(previewResponse.headers()["cache-control"] ?? "") && /noindex/.test(previewResponse.headers()["x-robots-tag"] ?? ""), previewResponse.headers()["cache-control"]);

  const anon = await (await fetch(`${BASE}/product/${ace.slug}`)).text();
  check("visitors still see the live page", !anon.includes("C9 draft description.") && anon.includes(ace.description.slice(0, 30)));

  const bypass = (await ctx.cookies()).find((c) => c.name === "__prerender_bypass");
  const stranger = await b.newContext();
  await stranger.addCookies([{ ...bypass }]);
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(`${BASE}/product/${ace.slug}`, { waitUntil: "load" });
  check("a copied preview cookie without a staff session shows only the live page", !(await strangerPage.content()).includes("C9 draft description.") && (await strangerPage.getByText("This is the saved draft").count()) === 0);
  await stranger.close();

  await Promise.all([page.waitForURL(`**/admin/products/${ace.id}`), page.getByRole("button", { name: "Leave preview" }).click()]);
  check("leaving preview returns to the editor and ends preview", !(await ctx.cookies()).some((c) => c.name === "__prerender_bypass"));

  // A draft that was never published can be previewed; visitors get a 404.
  await page.goto(`${BASE}/admin/products/new`, { waitUntil: "load" });
  await page.getByLabel("Item code").fill("C9-TEST-0001");
  await page.getByLabel("Name").fill("Preview test");
  await page.getByLabel("Category").selectOption(ace.category_id);
  await Promise.all([page.waitForURL("**/admin/products/*?created=1"), page.click("button:has-text('Create draft')")]);
  const newId = page.url().split("/").pop().split("?")[0];
  const draftPreview = await page.goto(`${BASE}/admin/preview?product=${newId}`, { waitUntil: "load" });
  check("a never-published draft can be previewed", draftPreview.status() === 200 && (await page.getByText("Preview test").count()) > 0);
  check("while visitors get a 404", (await fetch(`${BASE}/product/c9-test-0001`)).status === 404);
  await page.getByRole("button", { name: "Leave preview" }).click();
  await page.waitForURL(`**/admin/products/${newId}`);

  // ── history and restore ──
  await editor(ace.id);
  await publishNow();
  await page.reload({ waitUntil: "load" });
  await page.getByRole("tab", { name: /History/ }).click();
  const versions = page.getByRole("list", { name: "Published versions" }).getByRole("button");
  check("the history lists each published version", (await versions.count()) >= 2, `${await versions.count()} versions`);
  // The version before the C9 description.
  await versions.nth(1).click();
  const diffText = await page.locator("table").last().textContent();
  check("choosing a version shows how it differs", diffText.includes("Description") && diffText.includes("C9 draft description."));
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Restore version \d+ as a draft/ }).click();
  await page.waitForSelector("text=/is restored as a draft/");
  check("restore puts that version back in the editor", (await page.getByLabel("Description").inputValue()) !== "C9 draft description.");
  const { data: afterRestore } = await admin.from("products").select("description, version, published_version").eq("id", ace.id).single();
  check("as a draft, with the site unchanged", afterRestore.version !== afterRestore.published_version && (await (await fetch(`${BASE}/product/${ace.slug}`)).text()).includes("C9 draft description."));
  await publishNow();
  check("publishing the restored version puts it live", !(await (await fetch(`${BASE}/product/${ace.slug}`)).text()).includes("C9 draft description."));

  // ── activity ──
  await page.goto(`${BASE}/admin/activity`, { waitUntil: "load" });
  const firstRow = await page.locator("section:has(h2:text-is('Published')) tbody tr").first().textContent();
  check("the activity feed leads with the latest publish", firstRow.includes(ace.sku) && firstRow.includes(process.env.BOOTSTRAP_STAFF_EMAIL), firstRow.slice(0, 80));
  check("and lists what is waiting to be published", (await page.getByText(/Waiting to be published \(\d+\)/).count()) === 1);
  await page.getByRole("link", { name: "Earlier" }).click();
  await page.waitForURL("**/admin/activity?before=*");
  check("earlier publishes page back", (await page.locator("section:has(h2:text-is('Published')) tbody tr").count()) > 0);

  // ── sitemap ──
  const inSitemap = async () => (await (await fetch(`${BASE}/sitemap.xml`)).text()).includes(`/product/${other.slug}<`);
  check("a live product is in the sitemap", await inSitemap());
  await editor(other.id);
  await page.getByLabel("Discontinued: hidden from listings, page kept").check();
  await publishNow();
  check("publishing it as discontinued takes it out of the sitemap", !(await inSitemap()));
  await page.getByLabel("Live", { exact: true }).check();
  await publishNow();
  check("and making it live again puts it back", await inSitemap());

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
