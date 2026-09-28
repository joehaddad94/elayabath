// End-to-end check: categories, ordering, homepage, finish library.
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
const html = async (path) => (await fetch(`${BASE}${path}`)).text();
const order = (text, needles) => needles.map((n) => text.indexOf(n)).map((i) => (i < 0 ? Infinity : i));
const drafts = async () => (await admin.from("admin_products").select("id", { count: "exact", head: true }).eq("has_changes", true)).count;

// Originals, for putting everything back.
const { data: categories } = await admin.from("categories").select("id, slug, name, position, blurb, version").order("position");
const live = categories.filter((c) => !["shower-toilets", "urinals", "kitchen", "bidets", "accessible"].includes(c.slug));
const target = live[1];
const { data: products } = await admin.from("products").select("id, slug, sku, position, type_id").eq("category_id", target.id).order("position");
const { data: types } = await admin.from("product_types").select("id, slug, name").eq("category_id", target.id);
const usedType = types.find((t) => products.some((p) => p.type_id === t.id));
const typedProduct = products.find((p) => p.type_id === usedType.id);
const { data: featured } = await admin.from("products").select("id, slug, featured_rank").eq("featured", true).order("featured_rank");
const { data: white } = await admin.from("finishes").select("*").eq("code", "A00").maybeSingle();
const draftsBefore = await drafts();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 200)));
const go = (path) => page.goto(`${BASE}${path}`, { waitUntil: "load" });
const publishOrderNow = async () => {
  await page.getByRole("button", { name: "Publish this order" }).click();
  await page.waitForSelector("text=Order published. The site shows it now.");
};

try {
  await go("/admin/sign-in");
  await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

  // ── menu order ──
  await go("/admin/categories");
  check("the categories page lists every category", (await page.locator("ol[aria-label='Categories in menu order'] > li").count()) === categories.length);
  await page.getByRole("button", { name: `Move ${target.name} to the top` }).click();
  check("a change of order is flagged before it is live", (await page.getByText("The order has changed").count()) === 1);
  await publishOrderNow();
  const menu = await html("/products");
  const [a, b2] = order(menu, [`/products/${target.slug}"`, `/products/${live[0].slug}"`]);
  check("publishing the order changes the site's menu", a < b2, `${target.slug} before ${live[0].slug}`);
  // Drag it back with the mouse.
  const rows = page.locator("ol[aria-label='Categories in menu order'] > li");
  await rows.nth(0).dragTo(rows.nth(1));
  const firstAfterDrag = await rows.nth(0).textContent();
  check("dragging reorders too", firstAfterDrag.includes(live[0].name), firstAfterDrag.slice(0, 40));
  await publishOrderNow();

  // ── one category ──
  await go(`/admin/categories/${target.id}`);
  check("a published category's address is fixed", await page.getByLabel("Web address").getAttribute("readonly") !== null);
  const typeInput = page.locator(`input[aria-label^="Type "][value="${usedType.name}"]`);
  await typeInput.fill(`${usedType.name} C10`);
  await page.getByLabel("Description, a blank line between paragraphs").fill("C10 first paragraph.\n\nC10 second paragraph.");
  await page.getByLabel("New type name").fill("C10 new type");
  await page.getByRole("button", { name: "Add type" }).click();
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.waitForSelector("text=Published. Menus, shelves and its product pages show it now.");
  const { data: newTypes } = await admin.from("product_types").select("id").eq("category_id", target.id).eq("name", "C10 new type");
  check("a new type is added once", newTypes.length === 1);
  const productPage = await html(`/product/${typedProduct.slug}`);
  check("renaming a type reaches its live product pages", productPage.includes(`${usedType.name} C10`));
  const categoryPage = await html(`/products/${target.slug}`);
  check("the description reaches the category page, paragraph by paragraph", categoryPage.includes("C10 first paragraph.") && categoryPage.includes("C10 second paragraph."));
  check("a used type can't be removed", await page.locator(`li:has(input[value="${usedType.name} C10"]) button:has-text("Remove")`).isDisabled());
  // Take the new type out again; a second save must not add it twice.
  await page.locator(`li:has(input[value="C10 new type"]) button:has-text("Remove")`).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForSelector("text=Saved as a draft");
  check("an unused type is removed", (await admin.from("product_types").select("id").eq("category_id", target.id).eq("name", "C10 new type")).data.length === 0);

  // Product order within the category.
  const last = products[products.length - 1];
  await page.getByRole("button", { name: new RegExp(`^Move ${last.sku} .* to the top$`) }).click();
  await publishOrderNow();
  const shelf = await html(`/products/${target.slug}`);
  const [lastAt, firstAt] = order(shelf, [`/product/${last.slug}"`, `/product/${products[0].slug}"`]);
  check("publishing a category's product order changes its shelf", lastAt < firstAt);
  check("reordering left no product with unpublished changes", (await drafts()) === draftsBefore, `${await drafts()} vs ${draftsBefore}`);

  // ── homepage ──
  await go("/admin/homepage");
  const lastFeatured = featured[featured.length - 1];
  const featuredRows = page.locator("ol[aria-label='Featured products in homepage order'] > li");
  check("the homepage screen lists the featured products", (await featuredRows.count()) === featured.length);
  await featuredRows.last().getByRole("button", { name: /to the top$/ }).click();
  await publishOrderNow();
  const home = await html("/");
  const [lf, ff] = order(home, [`/product/${lastFeatured.slug}"`, `/product/${featured[0].slug}"`]);
  check("publishing the homepage order changes the homepage", lf < ff, `${lastFeatured.slug} at ${lf}, ${featured[0].slug} at ${ff}; ranks ${JSON.stringify((await admin.from("published_products").select("slug, featured_rank").eq("featured", true).order("featured_rank")).data?.map((p) => p.slug + ":" + p.featured_rank))}`);

  // ── finish library ──
  await go("/admin/finishes");
  await page.getByLabel("Show only").selectOption("shared");
  check("codes shared by two finishes are listed together", (await page.locator("ul li button[aria-pressed]").count()) === 6, `${await page.locator("ul li button[aria-pressed]").count()} shown`);
  await page.getByLabel("Show only").selectOption("");
  await page.getByLabel("Search finishes").fill("A00");
  await page.locator("ul li button[aria-pressed]").first().click();
  await page.getByLabel("Name", { exact: true }).first().fill(`${white.name} C10`);
  // A swatch, reduced and uploaded.
  const png = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 900;
    const g = c.getContext("2d"); g.fillStyle = "#e7e3da"; g.fillRect(0, 0, 900, 900);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    return [...new Uint8Array(await blob.arrayBuffer())];
  }));
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Replace swatch|Upload a swatch/ }).click();
  await (await chooser).setFiles({ name: "swatch.png", mimeType: "image/png", buffer: png });
  await page.waitForFunction(() => !document.body.textContent.includes("Uploading"));
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.waitForSelector("text=Published. Product pages and filters show it now.");
  const { data: white2 } = await admin.from("finishes").select("name, swatch_path, version, published_version").eq("id", white.id).single();
  check("a finish edit and its new swatch are saved and published", white2.name === `${white.name} C10` && white2.swatch_path.startsWith(`finishes/${white.id}/`) && white2.version === white2.published_version, white2.swatch_path);
  const { data: whiteUser } = await admin.from("product_finishes").select("products(slug, status)").eq("finish_id", white.id).limit(20);
  const liveUser = whiteUser.find((u) => u.products.status === "active");
  check("its product pages show the new name", (await html(`/product/${liveUser.products.slug}`)).includes(`${white.name} C10`));

  // A new finish goes live with the first product that uses it.
  await page.locator("form input[name=name]").fill("C10 Finish");
  await page.locator("form input[name=code]").fill("C10X");
  await page.locator("form select[name=family]").selectOption("ceramic");
  await page.getByRole("button", { name: "Add to the library" }).click();
  await page.waitForSelector("text=Added, unpublished.");
  const { data: created } = await admin.from("finishes").select("id, slug, published_version").eq("code", "C10X").single();
  check("a new finish is added unpublished", created.published_version === null);
  await go(`/admin/products/${typedProduct.id}`);
  await page.fill('input[placeholder="Name, code or material"]', "C10X");
  await page.locator('ul[aria-label="Finishes you can add"] button:has-text("C10 Finish")').click();
  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.waitForSelector("text=/Published\\./");
  const { data: createdAfter } = await admin.from("finishes").select("published_version").eq("id", created.id).single();
  check("publishing a product publishes its new finish first", createdAfter.published_version !== null);
  check("so the product page shows it", (await html(`/product/${typedProduct.slug}`)).includes("C10 Finish"));

  // Retired finishes leave the picker.
  await go(`/admin/finishes?finish=${created.id}`);
  await page.getByLabel(/^Retired/).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForSelector("text=Saved as a draft");
  check("the save message survives the refresh", (await page.getByText("Saved as a draft").count()) === 1);
  await go(`/admin/products/${products[0].id}`);
  await page.fill('input[placeholder="Name, code or material"]', "C10X");
  check("a retired finish is not offered in the picker", (await page.locator('ul[aria-label="Finishes you can add"] button').count()) === 0);

  // An unused, unpublished finish can be deleted.
  await go("/admin/finishes");
  await page.locator("form input[name=name]").fill("C10 Delete me");
  await page.locator("form input[name=code]").fill("C10D");
  await page.locator("form select[name=family]").selectOption("resin");
  await page.getByRole("button", { name: "Add to the library" }).click();
  await page.waitForSelector("text=Added, unpublished.");
  await page.getByRole("button", { name: "Delete this finish" }).click();
  await confirmModal(page);
  await page.waitForFunction(() => !document.body.textContent.includes("C10 Delete me"), null, { timeout: 10000 });
  check("an unused, never-published finish can be deleted", (await admin.from("finishes").select("id").eq("code", "C10D")).data.length === 0);

  // A product in a draft category says so.
  const { data: draftCat } = await admin.from("categories").select("id").eq("slug", "urinals").single();
  const { data: draftProduct } = await admin.from("products").select("id").eq("category_id", draftCat.id).limit(1).single();
  await go(`/admin/products/${draftProduct.id}`);
  check("the editor warns when a product's category is a draft", (await page.getByText("This category is a draft").count()) === 1);

  for (const path of ["/admin/categories", `/admin/categories/${target.id}`, "/admin/homepage", "/admin/finishes"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(path);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 0) errors.push(`${path} is ${over}px wider than a phone`);
  }
  check("no errors in the console, and every screen fits a phone", errors.length === 0, errors[0] ?? "");
} catch (e) {
  results.push(`FAIL stopped: ${e.message.split("\n")[0]}`);
  await page.screenshot({ path: process.env.SHOT ?? "e2e-fail.png" }).catch(() => {});
} finally {
  // Put it all back.
  await admin.rpc("set_category_order", { p_ids: categories.map((c) => c.id) });
  await admin.rpc("set_product_order", { p_category: target.id, p_ids: products.map((p) => p.id) });
  await admin.rpc("set_featured_order", { p_ids: featured.map((p) => p.id) });
  await admin.from("categories").update({ blurb: target.blurb }).eq("id", target.id);
  await admin.from("product_types").update({ name: usedType.name }).eq("id", usedType.id);
  await admin.from("product_types").delete().eq("category_id", target.id).eq("name", "C10 new type");
  await admin.rpc("publish_category", { p_id: target.id, p_note: "c10 verify restore" });
  const whiteFields = omit(white, ["id", "version", "published_version", "created_at", "updated_at", "updated_by"]);
  await admin.from("finishes").update(whiteFields).eq("id", white.id);
  await admin.rpc("publish_finish", { p_id: white.id, p_note: "c10 verify restore" });
  const { data: c10 } = await admin.from("finishes").select("id").in("code", ["C10X", "C10D"]);
  for (const f of c10 ?? []) {
    await admin.from("product_finishes").delete().eq("finish_id", f.id);
    await admin.from("published_finishes").delete().eq("finish_id", f.id);
    await admin.from("finishes").delete().eq("id", f.id);
  }
  await admin.rpc("publish_product", { p_id: typedProduct.id, p_note: "c10 verify restore" });
  const swatches = (await admin.storage.from("swatches").list(`finishes/${white.id}`)).data ?? [];
  if (swatches.length) await admin.storage.from("swatches").remove(swatches.map((o) => `finishes/${white.id}/${o.name}`));
  await admin.from("sign_in_log").delete().neq("id", 0);
  // The data was put back directly, so refresh the site's cached pages too;
  // otherwise the next run (or a person) would see what the test left.
  await fetch(`${BASE}/api/admin/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => {});
  await b.close();
}
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} passed`);
