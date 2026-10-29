// End-to-end check: gallery, data sheet and the storage meter.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const omit = (row, keys) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
const BASE = process.env.BASE ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
await admin.from("sign_in_log").delete().neq("id", 0);

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail !== "" ? "  (" + detail + ")" : ""}`);

const { data: original } = await admin.from("products").select("*").eq("sku", "E02-SW20001").single();
const { data: originalImages } = await admin.from("product_images").select("path, alt, caption, position, width, height").eq("product_id", original.id).order("position");
const folder = `products/${original.id}`;
const listFolder = async () => (await admin.storage.from("product-media").list(folder, { limit: 100 })).data ?? [];

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
const inflight = new Map();
page.on("request", (r) => inflight.set(r, Date.now()));
page.on("requestfinished", (r) => inflight.delete(r));
page.on("requestfailed", (r) => inflight.delete(r));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 200)));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().slice(0, 160)}`); });

// A 4000 x 3000 JPEG, the size of a phone photo, drawn in the browser.
const bigPhoto = async (hue) => Buffer.from(await page.evaluate(async (h) => {
  const c = document.createElement("canvas"); c.width = 4000; c.height = 3000;
  const g = c.getContext("2d");
  for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${(h + i) % 360} 70% ${20 + (i % 60)}%)`; g.fillRect((i * 97) % 4000, (i * 53) % 3000, 400, 300); }
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
  return [...new Uint8Array(await blob.arrayBuffer())];
}, hue));
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

try {
  await page.goto(`${BASE}/admin/sign-in`, { waitUntil: "load" });
  await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
  await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);
  const photoA = await bigPhoto(10);
  const photoB = await bigPhoto(200);

  await page.goto(`${BASE}/admin/products/${original.id}`, { waitUntil: "load" });
  check("the gallery shows the current photos", (await page.locator("ol li:has-text('Main photo')").count()) === 1 && originalImages.length >= 1);

  // Upload two phone-sized photos and a file that isn't one.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add photographs" }).click();
  await (await chooser).setFiles([
    { name: "front.jpg", mimeType: "image/jpeg", buffer: photoA },
    { name: "side.jpg", mimeType: "image/jpeg", buffer: photoB },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
  ]);
  await page.waitForFunction((n) => document.querySelectorAll("ol li img").length >= n, originalImages.length + 2, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector("[role=status]")?.textContent?.includes("uploading"), null, { timeout: 30000 });
  check("a file that isn't a photo is refused, by name", (await page.getByText("notes.txt isn't a photograph.").count()) === 1);

  const stored = await listFolder();
  const sizes = stored.map((o) => o.metadata?.size ?? 0);
  check("both photos are uploaded into the product's folder", stored.length === 2, stored.map((o) => o.name).join(", "));
  check("as WebP, reduced from a phone-sized original", stored.every((o) => o.metadata?.mimetype === "image/webp") && Math.max(...sizes) < photoA.length, `${Math.round(photoA.length / 1024)} KB -> ${sizes.map((s) => Math.round(s / 1024)).join(", ")} KB`);
  check("the product doesn't change until saved", (await admin.from("product_images").select("id").eq("product_id", original.id)).data.length === originalImages.length);

  // Alt text, make main, save.
  const items = page.locator("ol li:has(img)");
  const count = await items.count();
  await items.nth(count - 2).getByLabel("Alt text").fill("ACE bathtub, front view");
  await items.nth(count - 2).getByLabel("Caption").fill("Front");
  await items.nth(count - 2).getByRole("button", { name: "Make main" }).click();
  // Data sheet.
  const sheetChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Replace|Upload a PDF/ }).click();
  await (await sheetChooser).setFiles({ name: "sheet.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.waitForSelector("a:has-text('Open the data sheet')");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForSelector("text=Saved as a draft");

  const { data: saved } = await admin.from("product_images").select("path, alt, caption, width, height").eq("product_id", original.id).order("position");
  const { data: savedProduct } = await admin.from("products").select("datasheet_path").eq("id", original.id).single();
  check("the new photo is saved as the main photo, with its alt text and caption", saved[0].path.startsWith(folder) && saved[0].alt === "ACE bathtub, front view" && saved[0].caption === "Front", saved[0].path);
  check("with its reduced size recorded", saved[0].width === 1600 && saved[0].height === 1200, `${saved[0].width} x ${saved[0].height}`);
  check("the whole gallery is saved in order", saved.length === originalImages.length + 2);
  check("the data sheet is saved from the product's folder", savedProduct.datasheet_path.startsWith(folder) && savedProduct.datasheet_path.endsWith(".pdf"));
  const { data: gridRow } = await admin.from("admin_products").select("image_path").eq("id", original.id).single();
  check("the grid's thumbnail follows the main photo", gridRow.image_path === saved[0].path);

  // Publish; the site follows.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.waitForSelector("text=Published. The site shows it now.");
  const html = await (await fetch(`${BASE}/product/${original.slug}`)).text();
  check("the live page leads with the new photo", html.includes(encodeURIComponent(saved[0].path)) || html.includes(saved[0].path));
  check("and links the new data sheet", html.includes(savedProduct.datasheet_path));

  await page.goto(`${BASE}/admin`, { waitUntil: "load" });
  check("the overview shows storage used", (await page.getByText("Storage used").count()) === 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/admin/products/${original.id}`, { waitUntil: "load" });
  await page.waitForSelector("text=Main photo");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("the gallery fits a phone screen", overflow <= 0, `${overflow}px over`);

  check("no errors in the browser console", errors.length === 0, errors[0] ?? "");
} catch (e) {
  results.push(`FAIL stopped: ${e.message.split("\n")[0]}`);
  await page.screenshot({ path: process.env.SHOT ?? "e2e-fail.png" }).catch(() => {});
} finally {
  const id = original.id;
  const fields = omit(original, ["id", "version", "published_version", "created_at", "updated_at", "updated_by", "import_job_id"]);
  await admin.from("products").update(fields).eq("id", id);
  await admin.from("product_images").delete().eq("product_id", id);
  await admin.from("product_images").insert(originalImages.map((i) => ({ ...i, product_id: id })));
  await admin.rpc("publish_product", { p_id: id, p_note: "c8 verify restore" });
  const leftovers = await listFolder();
  if (leftovers.length) await admin.storage.from("product-media").remove(leftovers.map((o) => `${folder}/${o.name}`));
  const sheets = (await admin.storage.from("datasheets").list(folder)).data ?? [];
  if (sheets.length) await admin.storage.from("datasheets").remove(sheets.map((o) => `${folder}/${o.name}`));
  await admin.from("sign_in_log").delete().neq("id", 0);
  // The data was put back directly, so refresh the site's cached pages too;
  // otherwise the next run (or a person) would see what the test left.
  await fetch(`${BASE}/api/admin/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => {});
  await b.close();
}
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} passed`);
