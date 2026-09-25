/**
 * Staged catalogue -> Supabase.
 *
 *   INGEST_OUT=.seed INGEST_SLICE=all npm run ingest   # stage it
 *   npm run seed                                       # load it
 *
 * Loads the full scraped catalogue into an empty database: the finish
 * library, the categories, every product with its photograph, finishes and
 * data sheet, the per-finish photographs, the addresses the site publishes,
 * and the first staff member. Then publishes what should be live through the
 * same publish functions the dashboard's Publish button calls.
 *
 * Refuses to run against a database that already has products. On a hosted
 * project, staff edits live there and a seed would overwrite them. Locally,
 * `npm run db:reset` empties the database first.
 *
 * Uses the service key, read from the environment (.env.local locally). It
 * is one of the three places that key is used; the running app is another,
 * for direct sign-in only.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES } from "../ingest/config.ts";
import dictionary from "../../src/lib/i18n/dictionaries/en.ts";
import type { CatalogueMeta, Category, Finish, Product } from "../../src/lib/types.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const STAGE = path.resolve(ROOT, process.env.INGEST_OUT ?? ".seed");

interface FinishImage {
  product: string;
  finish: string;
  src: string;
  width: number;
  height: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. See .env.example.`);
    process.exit(2);
  }
  return value;
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const secret = required("SUPABASE_SECRET_KEY");
const bootstrap = required("BOOTSTRAP_STAFF_EMAIL").trim().toLowerCase();

const db = createClient(url, secret, { auth: { persistSession: false } });

async function readStage<T>(name: string): Promise<T> {
  const file = path.join(STAGE, "data", name);
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    console.error(`Missing ${path.relative(ROOT, file)}. Run the seed-mode ingest first:`);
    console.error("  INGEST_OUT=.seed INGEST_SLICE=all npm run ingest");
    process.exit(2);
  }
}

/** Throws on a Supabase error, so a half-loaded seed never looks like a
 *  finished one. Writes without `.select()` return no data, and nothing reads
 *  it; writes with one always return rows. */
function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

/** Runs tasks a few at a time: fast enough, without hammering the API. */
async function pool<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await task(item);
    }
  });
  await Promise.all(workers);
}

async function upload(bucket: string, objectPath: string, file: string, contentType: string) {
  const body = await fs.readFile(file);
  const { error } = await db.storage
    .from(bucket)
    .upload(objectPath, body, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${bucket}/${objectPath}: ${error.message}`);
}

async function main() {
  const products = await readStage<Product[]>("products.json");
  const categories = await readStage<Category[]>("categories.json");
  const finishes = await readStage<Finish[]>("finishes.json");
  const meta = await readStage<CatalogueMeta>("meta.json");
  const finishImages = await readStage<FinishImage[]>("finish-images.json");
  const gaps = await readStage<Array<{ sku: string; gap: string }>>("gaps.json");

  // ── refuse to overwrite ────────────────────────────────────────────────
  const existing = await db.from("products").select("id", { count: "exact", head: true });
  if (existing.error) throw new Error(existing.error.message);
  if ((existing.count ?? 0) > 0) {
    console.error(
      `This database already has ${existing.count} products. The seed only loads an empty ` +
        `catalogue, so it can never overwrite staff edits. Locally: npm run db:reset`,
    );
    // exitCode, not exit(): exiting with network handles still open trips a
    // libuv assertion on Windows and prints what looks like a crash.
    process.exitCode = 1;
    return;
  }

  console.log(
    `staged: ${products.length} products, ${categories.length} categories, ` +
      `${finishes.length} finishes, ${finishImages.length} per-finish photos, ${gaps.length} gaps`,
  );

  // ── who and what may sign in ───────────────────────────────────────────
  // Every address the site publishes, from the site's own dictionary, so the
  // two can never drift apart.
  const reserved = [...new Set(Object.values(dictionary.contactAddresses).map((e) => e.toLowerCase()))];
  must(await db.from("reserved_addresses").upsert(reserved.map((email) => ({ email }))), "reserved addresses");
  must(await db.from("staff").upsert({ email: bootstrap, invited_by: "seed" }), "bootstrap staff");
  console.log(`staff: ${bootstrap} · reserved addresses: ${reserved.length}`);

  must(
    await db.from("catalogue_meta").upsert({
      id: true,
      products_in_catalogue: meta.productsInCatalogue,
      categories_in_catalogue: meta.categoriesInCatalogue,
      finishes_in_catalogue: meta.finishesInCatalogue,
    }),
    "catalogue meta",
  );

  // ── media ──────────────────────────────────────────────────────────────
  const staged = (p: string) => path.join(STAGE, "public", p.replace(/^\/+/, ""));
  const jobs: Array<() => Promise<void>> = [];
  for (const p of products) {
    const image = p.image;
    if (image) {
      jobs.push(() => upload("product-media", `products/${p.slug}.webp`, staged(image.src), "image/webp"));
    }
    if (p.datasheet) {
      jobs.push(() => upload("datasheets", `${p.slug}.pdf`, staged(p.datasheet!), "application/pdf"));
    }
  }
  for (const f of finishes) {
    if (f.image) jobs.push(() => upload("swatches", `${f.slug}.webp`, staged(f.image!), "image/webp"));
  }
  for (const fi of finishImages) {
    jobs.push(() =>
      upload("product-media", `finishes/${fi.product}--${fi.finish}.webp`, staged(fi.src), "image/webp"),
    );
  }
  let done = 0;
  await pool(jobs, 6, async (job) => {
    await job();
    done += 1;
    if (done % 100 === 0) console.log(`  uploaded ${done}/${jobs.length}`);
  });
  console.log(`media: ${jobs.length} files uploaded`);

  // ── the finish library ─────────────────────────────────────────────────
  const finishRows = must(
    await db
      .from("finishes")
      .insert(
        finishes.map((f) => ({
          slug: f.slug,
          code: f.code,
          name: f.name,
          family: f.family,
          swatch_path: f.image ? `${f.slug}.webp` : null,
        })),
      )
      .select("id, slug"),
    "finishes",
  );
  const finishId = new Map(finishRows.map((r) => [r.slug, r.id]));

  // ── categories and their product types ─────────────────────────────────
  const staging = new Map(categories.map((c) => [c.slug, c]));
  const categoryRows = must(
    await db
      .from("categories")
      .insert(
        CATEGORIES.filter((c) => staging.has(c.slug)).map((c, position) => ({
          slug: c.slug,
          name: c.name,
          blurb: staging.get(c.slug)?.blurb ?? [],
          position,
          image: c.image ? `/rooms/${c.image}` : null,
          icon: c.icon ? `/icons/${c.icon}` : null,
        })),
      )
      .select("id, slug"),
    "categories",
  );
  const categoryId = new Map(categoryRows.map((r) => [r.slug, r.id]));
  const draftCategories = new Set(CATEGORIES.filter((c) => c.draft).map((c) => c.slug));

  const types = new Map<string, { category_id: string; slug: string; name: string }>();
  for (const p of products) {
    types.set(`${p.categorySlug}/${p.type.slug}`, {
      category_id: categoryId.get(p.categorySlug)!,
      slug: p.type.slug,
      name: p.type.name,
    });
  }
  const typeRows = must(
    await db.from("product_types").insert([...types.values()]).select("id, slug, category_id"),
    "product types",
  );
  const typeId = new Map(typeRows.map((r) => [`${r.category_id}/${r.slug}`, r.id]));

  // ── products ───────────────────────────────────────────────────────────
  // Featured: exactly what the homepage shows today, so moving it onto the
  // database changes nothing a visitor can see. The committed slice holds
  // the site's current catalogue order.
  const current = JSON.parse(await fs.readFile(path.join(ROOT, "data", "products.json"), "utf8")) as Product[];
  const featured = new Set(current.slice(0, 12).map((p) => p.slug));
  const hero = current.find((p) => p.categorySlug === "bathtubs");
  if (hero) featured.add(hero.slug);

  const positionInCategory = new Map<string, number>();
  const productRows = must(
    await db
      .from("products")
      .insert(
        products.map((p) => {
          const position = positionInCategory.get(p.categorySlug) ?? 0;
          positionInCategory.set(p.categorySlug, position + 1);
          const cat = categoryId.get(p.categorySlug)!;
          return {
            sku: p.sku,
            slug: p.slug,
            name: p.name,
            category_id: cat,
            type_id: typeId.get(`${cat}/${p.type.slug}`) ?? null,
            description: p.description ?? "",
            dimensions: p.dimensions,
            features: p.features,
            datasheet_path: p.datasheet ? `${p.slug}.pdf` : null,
            featured: featured.has(p.slug),
            position,
          };
        }),
      )
      .select("id, slug"),
    "products",
  );
  const productId = new Map(productRows.map((r) => [r.slug, r.id]));

  const images = products.flatMap((p) =>
    p.image
      ? [{
          product_id: productId.get(p.slug)!,
          path: `products/${p.slug}.webp`,
          alt: p.image.alt,
          width: p.image.width,
          height: p.image.height,
          position: 0,
        }]
      : [],
  );
  for (let i = 0; i < images.length; i += 500) {
    must(await db.from("product_images").insert(images.slice(i, i + 500)), "product images");
  }

  const finishPhoto = new Map(
    finishImages.map((fi) => [`${fi.product}/${fi.finish}`, `finishes/${fi.product}--${fi.finish}.webp`]),
  );
  const links = products.flatMap((p) =>
    p.finishes
      .filter((slug) => finishId.has(slug))
      .map((slug, position) => ({
        product_id: productId.get(p.slug)!,
        finish_id: finishId.get(slug)!,
        position,
        image_path: finishPhoto.get(`${p.slug}/${slug}`) ?? null,
      })),
  );
  for (let i = 0; i < links.length; i += 1000) {
    must(await db.from("product_finishes").insert(links.slice(i, i + 1000)), "product finishes");
  }
  console.log(`loaded: ${productRows.length} products, ${images.length} photos, ${links.length} finish links`);

  // ── publish what is live on the old site ───────────────────────────────
  // Through the same functions the dashboard's Publish button calls. The
  // five new categories and their products stay as drafts.
  for (const f of finishRows) {
    must(await db.rpc("publish_finish", { p_id: f.id, p_note: "Seeded from the old site" }), `publish finish ${f.slug}`);
  }
  for (const c of categoryRows) {
    if (draftCategories.has(c.slug)) continue;
    must(await db.rpc("publish_category", { p_id: c.id, p_note: "Seeded from the old site" }), `publish category ${c.slug}`);
  }
  const live = products.filter((p) => !draftCategories.has(p.categorySlug));
  await pool(live, 6, async (p) => {
    must(
      await db.rpc("publish_product", { p_id: productId.get(p.slug)!, p_note: "Seeded from the old site" }),
      `publish product ${p.sku}`,
    );
  });

  // The homepage's manual order starts as the order it showed before: by name.
  const featuredOrder = products
    .filter((p) => featured.has(p.slug))
    .sort((a, b) => a.name.localeCompare(b.name) || a.sku.localeCompare(b.sku))
    .map((p) => productId.get(p.slug)!);
  must(await db.rpc("set_featured_order", { p_ids: featuredOrder }), "featured order");

  // ── check the result against what was staged ───────────────────────────
  const count = async (table: string) => {
    const r = await db.from(table).select("*", { count: "exact", head: true });
    if (r.error) throw new Error(r.error.message);
    return r.count ?? 0;
  };
  const report = {
    products: [await count("products"), products.length],
    published_products: [await count("published_products"), live.length],
    categories: [await count("categories"), categoryRows.length],
    published_categories: [await count("published_categories"), categoryRows.length - draftCategories.size],
    finishes: [await count("published_finishes"), finishes.length],
    product_finishes: [await count("product_finishes"), links.length],
  };
  let ok = true;
  for (const [name, [got, want]] of Object.entries(report)) {
    const mark = got === want ? "ok " : "BAD";
    if (got !== want) ok = false;
    console.log(`  ${mark} ${name.padEnd(22)} ${got} (expected ${want})`);
  }
  if (!ok) {
    process.exitCode = 1;
    return;
  }
  console.log(
    `\nseeded. ${live.length} products live, ${products.length - live.length} in draft categories; ` +
      `${gaps.length} gap(s) recorded in ${path.relative(ROOT, path.join(STAGE, "data", "gaps.json"))}.`,
  );
}

await main();
