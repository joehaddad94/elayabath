// End-to-end check: the product editor against the running server.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const omit = (row, keys) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
/** Answers the dashboard's confirmation dialog: its last button confirms. */
const confirmModal = async (p) => {
  const dialog = p.getByRole("alertdialog");
  await dialog.waitFor({ timeout: 10000 });
  await dialog.getByRole("button").last().click();
  await dialog.waitFor({ state: "hidden" });
};
const BASE = process.env.BASE ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
await admin.from("sign_in_log").delete().neq("id", 0);

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail !== "" ? "  (" + detail + ")" : ""}`);

// A live product with a type and at least three finishes.
const { data: pick } = await admin.from("admin_products").select("id").eq("status", "active").not("type_id", "is", null).gte("finish_count", 3).order("sku").limit(1).single();
const { data: original } = await admin.from("products").select("*").eq("id", pick.id).single();
const { data: originalLinks } = await admin.from("product_finishes").select("finish_id, position, image_path, code_override").eq("product_id", pick.id).order("position");
const { data: lib } = await admin.from("finishes").select("id, name, code").eq("status", "active").order("name");
const extra = lib.find((f) => !originalLinks.some((l) => l.finish_id === f.id));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 200)));
page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url().slice(0, 120)}`); });

try {
  await page.goto(`${BASE}/admin/sign-in`, { waitUntil: "networkidle" });
  await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

  // From the grid: the item code opens the editor.
  await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Name or item code"]', original.sku);
  await page.waitForTimeout(1200);
  await Promise.all([page.waitForURL(`**/admin/products/${original.id}`), page.click(`.ag-row a[href="/admin/products/${original.id}"]`)]);
  await page.waitForSelector("form fieldset");
  const label = (text) => page.getByLabel(text, { exact: true });
  check("the item code in the grid opens the editor", (await label("Name").inputValue()) === original.name, original.sku);
  check("finishes load in order", (await page.locator("fieldset:has(legend:text-is(\"Finishes\")) ol li").count()) === originalLinks.length, `${originalLinks.length} finishes`);
  const scoreBefore = await page.locator("h2:has-text('Completeness') span").textContent();

  // Validation: nothing is sent while a field is wrong.
  await label("Name").fill("");
  await page.click("button:has-text('Save draft')");
  await page.waitForTimeout(400);
  const nameInvalid = await label("Name").getAttribute("aria-invalid");
  const { data: v0 } = await admin.from("products").select("version").eq("id", original.id).single();
  check("an empty name is refused before saving", nameInvalid === "true" && v0.version === original.version, await page.locator("[class*=error]").first().textContent());
  await label("Name").fill(original.name);

  // Edit, add a finish, reorder, save.
  await label("Description").fill("C7 test description.");
  await label("Dimensions").fill("100 x 200 x 300 mm");
  await label("Features, one per line").fill("First feature\n\nSecond feature");
  await page.fill('input[placeholder="Name, code or material"]', extra.code);
  await page.locator(`ul[aria-label="Finishes you can add"] button:has-text("${extra.name}")`).first().click();
  const finishItems = page.locator("fieldset:has(legend:text-is(\"Finishes\")) ol li");
  const lastName = (await finishItems.last().textContent()) ?? "";
  check("a finish is added from the library", lastName.includes(extra.name), extra.name);
  await finishItems.last().getByRole("button", { name: /Move .* up/ }).click();
  const unsavedBadge = await page.locator("text=Unsaved changes").count();
  check("unsaved changes are flagged", unsavedBadge === 1);
  await page.keyboard.press("Control+s");
  await page.waitForSelector("text=Saved as a draft");

  const { data: s1 } = await admin.from("products").select("description, dimensions, features, version, published_version").eq("id", original.id).single();
  const { data: l1 } = await admin.from("product_finishes").select("finish_id, position").eq("product_id", original.id).order("position");
  check("Ctrl+S saves every field", s1.description === "C7 test description." && s1.dimensions === "100 x 200 x 300 mm" && JSON.stringify(s1.features) === '["First feature","Second feature"]', JSON.stringify(s1.features));
  check("as one new version", s1.version === original.version + 1, `v${original.version} -> v${s1.version}`);
  check("finishes saved in the order shown", l1.length === originalLinks.length + 1 && l1[l1.length - 2].finish_id === extra.id, `${extra.code} second to last`);
  const kept = originalLinks.find((l) => l.image_path);
  if (kept) {
    const { data: stillThere } = await admin.from("product_finishes").select("image_path").eq("product_id", original.id).eq("finish_id", kept.finish_id).single();
    check("a kept finish keeps its own photo", stillThere.image_path === kept.image_path);
  }
  const { data: liveBefore } = await admin.from("published_products").select("snapshot").eq("product_id", original.id).single();
  check("the site is unchanged until publish", liveBefore.snapshot.description === original.description);
  const badges = await page.locator("[class*=badges]").textContent();
  check("the badge moves to unpublished changes", badges.includes("Unpublished changes") && !badges.includes("Unsaved"), badges);

  // Conflict, overwrite.
  await admin.from("products").update({ dimensions: "Their dimensions" }).eq("id", original.id);
  await label("Dimensions").fill("My dimensions");
  await page.click("button:has-text('Save draft')");
  await page.waitForSelector("text=while you were editing it");
  const { data: c1 } = await admin.from("products").select("dimensions").eq("id", original.id).single();
  check("a stale save is refused and names who saved", c1.dimensions === "Their dimensions" && (await page.locator("[role=alert] strong").textContent()) !== "");
  await page.click("button:has-text('Keep mine and overwrite')");
  await page.waitForSelector("text=Saved as a draft");
  const { data: c2 } = await admin.from("products").select("dimensions").eq("id", original.id).single();
  check("'keep mine' overwrites deliberately", c2.dimensions === "My dimensions");

  // Conflict, load theirs.
  await admin.from("products").update({ dimensions: "Theirs again" }).eq("id", original.id);
  await label("Dimensions").fill("Mine again");
  await page.click("button:has-text('Save draft')");
  await page.waitForSelector("text=while you were editing it");
  await page.click("button:has-text('Load their version')");
  await page.waitForFunction(() => [...document.querySelectorAll("input")].some((i) => i.value === "Theirs again"), null, { timeout: 8000 });
  check("'load theirs' replaces the form with their version", (await label("Dimensions").inputValue()) === "Theirs again");

  // Category change drops a type that isn't in the new category.
  const typeBefore = await label("Type").inputValue();
  const categories = await label("Category").locator("option").evaluateAll((os) => os.map((o) => o.value));
  const otherCategory = categories.find((c) => c !== original.category_id);
  await label("Category").selectOption(otherCategory);
  const typeAfter = await label("Type").inputValue();
  check("changing category clears a type from the old one", typeBefore !== "" && typeAfter === "");
  await label("Category").selectOption(original.category_id);
  await label("Type").selectOption(original.type_id);

  // Publish; the site follows.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.waitForSelector("text=Published. The site shows it now.");
  const html = await (await fetch(`${BASE}/product/${original.slug}`)).text();
  check("publishing puts the saved draft live", html.includes("Theirs again"));
  check("and the score reflects the added finish", (await page.locator("h2:has-text('Completeness') span").textContent()) >= scoreBefore, `${scoreBefore} -> ${await page.locator("h2:has-text('Completeness') span").textContent()}`);
  check("nothing left to publish", await page.getByRole("button", { name: "Publish", exact: true }).isDisabled());

  // A new address leaves a redirect.
  const newSlug = `${original.slug}-c7`;
  await page.getByLabel("Web address").fill(newSlug);
  check("the editor warns that the old address will redirect", (await page.getByText(`/product/${original.slug} will redirect here`).count()) === 1);
  await page.click("button:has-text('Save and publish')");
  await page.waitForSelector("text=Published. The site shows it now.");
  const old = await fetch(`${BASE}/product/${original.slug}`, { redirect: "manual" });
  check("the old address redirects to the new one", [307, 308].includes(old.status) && (old.headers.get("location") ?? "").endsWith(`/product/${newSlug}`), `${old.status} ${old.headers.get("location")}`);

  // Discontinue.
  await page.getByLabel("Discontinued: hidden from listings, page kept").check();
  await page.click("button:has-text('Save and publish')");
  await page.waitForSelector("text=stays hidden from listings");
  const disc = await (await fetch(`${BASE}/product/${newSlug}`)).text();
  check("a discontinued product keeps its page, marked", /discontinued/i.test(disc));

  // New product: a duplicate code is refused and the form keeps what was typed.
  await page.goto(`${BASE}/admin/products/new`, { waitUntil: "networkidle" });
  await page.getByLabel("Item code").fill(original.sku);
  await page.getByLabel("Name").fill("Duplicate");
  await page.getByLabel("Category").selectOption(original.category_id);
  await page.click("button:has-text('Create draft')");
  await page.waitForSelector("text=Another product already has this item code");
  check("a duplicate item code is refused, form kept", (await page.getByLabel("Name").inputValue()) === "Duplicate" && (await page.getByLabel("Category").inputValue()) === original.category_id);
  await page.getByLabel("Item code").fill("C7-TEST-0001");
  await Promise.all([page.waitForURL("**/admin/products/*?created=1"), page.click("button:has-text('Create draft')")]);
  await page.waitForSelector("text=Created as a draft");
  const { data: made } = await admin.from("products").select("id, slug, status").eq("sku", "C7-TEST-0001").single();
  check("a new product is created as a draft", made.status === "draft" && made.slug === "c7-test-0001");
  check("the new product is not on the site", (await fetch(`${BASE}/product/c7-test-0001`)).status === 404);

  // Phone width: nothing wider than the screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("the editor fits a phone screen", overflow <= 0, `${overflow}px over`);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.click("button:has-text('Delete this draft')");
  await Promise.all([page.waitForURL(`${BASE}/admin/products`), confirmModal(page)]);
  const { data: gone } = await admin.from("products").select("id").eq("sku", "C7-TEST-0001").maybeSingle();
  check("a never-published draft can be deleted", gone === null);
  const { error: refused } = await admin.rpc("delete_draft_product", { p_id: original.id });
  check("a published product cannot be deleted", refused?.code === "PT409", refused?.message);

  check("no errors in the browser console", errors.length === 0, errors[0] ?? "");
} catch (e) {
  results.push(`FAIL stopped: ${e.message.split("\n")[0]}`);
  await page.screenshot({ path: process.env.SHOT ?? "e2e-fail.png" }).catch(() => {});
} finally {
  // Put the product back as it was, and live again as it was.
  await admin.from("products").delete().eq("sku", "C7-TEST-0001");
  const id = original.id;
  const fields = omit(original, ["id", "version", "published_version", "created_at", "updated_at", "updated_by", "import_job_id"]);
  await admin.from("products").update(fields).eq("id", id);
  await admin.from("product_finishes").delete().eq("product_id", id);
  await admin.from("product_finishes").insert(originalLinks.map((l) => ({ ...l, product_id: id })));
  await admin.rpc("publish_product", { p_id: id, p_note: "c7 verify restore" });
  await admin.from("redirects").delete().eq("from_slug", `${original.slug}-c7`);
  await admin.from("sign_in_log").delete().neq("id", 0);
  // The data was put back directly, so refresh the site's cached pages too;
  // otherwise the next run (or a person) would see what the test left.
  await fetch(`${BASE}/api/admin/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => {});
  await b.close();
}
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} passed`);
