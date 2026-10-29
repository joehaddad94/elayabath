// End-to-end check: the Products list against the running server.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3000";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
await admin.from("sign_in_log").delete().neq("id", 0);

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name}${detail !== "" ? "  (" + detail + ")" : ""}`);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().slice(0, 160)}`); });

await page.goto(`${BASE}/admin/sign-in`, { waitUntil: "networkidle" });
await page.fill("#email", process.env.BOOTSTRAP_STAFF_EMAIL);
await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);

const { count: total } = await admin.from("products").select("id", { count: "exact", head: true });
const { count: hiddenCount } = await admin.from("products").select("id", { count: "exact", head: true }).eq("status", "draft");
const { count: incomplete } = await admin.from("admin_products").select("id", { count: "exact", head: true }).lt("completeness", 6);

await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
const count = () => page.locator("p[aria-live]").first().textContent();
const rows = () => page.locator('ul[aria-label="Products"] > li:not([aria-hidden])').count();
check("every product loads at once", (await count()).startsWith(`${total.toLocaleString("en")} products`), await count());
check("and every row is in the list", (await rows()) === total, `${await rows()} rows`);

await page.fill('input[type="search"]', "arco");
check("search narrows the list", /^Showing \d+ of/.test(await count()), await count());
check("and the address carries it", page.url().includes("q=arco"), page.url());
await page.click("text=Clear filters");
check("clear filters puts everything back", !(await count()).startsWith("Showing"), await count());

await page.check("text=Missing details");
check("'missing details' finds the incomplete products", (await count()).startsWith(`Showing ${incomplete}`), `${await count()} vs ${incomplete}`);
await page.uncheck("text=Missing details");
await page.getByLabel("On the site").selectOption("hidden");
check("'hidden only' finds the hidden products", (await count()).startsWith(`Showing ${hiddenCount}`), `${await count()} vs ${hiddenCount}`);
await page.getByLabel("On the site").selectOption("");

// the switch: hide the first visible product, the site follows, then undo
await page.getByLabel("On the site").selectOption("visible");
const firstSwitch = page.locator('[role="switch"]').first();
const label = await firstSwitch.getAttribute("aria-label");
const name = label.replace(/ on the site$/, "");
const { data: first } = await admin.from("products").select("id, slug, status, dimensions").eq("name", name).eq("status", "active").limit(1).single();
await firstSwitch.click();
await page.waitForSelector("text=is now hidden from the site");
const { data: hiddenNow } = await admin.from("products").select("status").eq("id", first.id).single();
check("the switch hides the product", hiddenNow.status === "draft");
check("and takes it off the site", (await fetch(`${BASE}/product/${first.slug}`)).status === 404);
await page.click("button:has-text('Undo')");
await page.waitForSelector("text=back on the site");
const { data: back } = await admin.from("products").select("status").eq("id", first.id).single();
check("undo puts it back", back.status === "active");

// conflict: someone else saves first, the switch refuses and says so
await admin.from("products").update({ dimensions: "999 x 999 mm" }).eq("id", first.id);
await page.locator(`[role="switch"][aria-label="${label}"]`).first().click();
const alert = await page.waitForSelector("[role=alert]");
const { data: after } = await admin.from("products").select("status").eq("id", first.id).single();
check("a stale switch is refused, not saved over someone else's", after.status === "active");
check("and the list says who changed it", (await alert.textContent()).includes("since the list loaded"));

// bulk: tick two, the bar offers only what applies, and asks first
await page.reload({ waitUntil: "networkidle" });
await page.getByLabel("On the site").selectOption("visible");
const boxes = page.locator('ul[aria-label="Products"] input[type=checkbox]');
await boxes.nth(0).check();
await boxes.nth(1).check();
check("with only visible products ticked, there is no 'Show on site'", (await page.locator("button:has-text('Show on site')").count()) === 0);
await page.click("button:has-text('Hide from site (2)')");
check("a bulk action asks first", await page.isVisible("text=Take 2 products off the site?"));
await page.click("role=button[name='Cancel']");

// the editor's way back keeps the filters
await page.locator('ul[aria-label="Products"] a[data-product]').nth(2).click();
await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);
check("the editor offers the next product", await page.isVisible("a[rel=next]"));
await page.click("nav[aria-label=Products] >> text=Products");
await page.waitForURL(/status=visible/);
check("'Products' returns to the filtered list", page.url().includes("status=visible"), page.url());

check("no errors in the browser console", errors.length === 0, errors[0] ?? "");

await admin.from("products").update({ dimensions: first.dimensions }).eq("id", first.id);
await admin.from("sign_in_log").delete().neq("id", 0);
await fetch(`${BASE}/api/admin/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}` } }).catch(() => {});
await b.close();
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("ok")).length}/${results.length} passed`);
