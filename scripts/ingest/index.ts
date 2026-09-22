/**
 * Archive -> data/
 *
 *   npm run ingest
 *
 * Reads the page-by-page crawl of the live site, selects the v1 slice,
 * normalises every record, re-encodes the images it needs, fetches the
 * technical data sheets, and writes the typed JSON the site is built from.
 *
 * Nothing downstream ever touches the archive. If this script cannot run
 * because the archive is not on this machine, the site still builds: data/
 * is committed.
 *
 * Every record is validated before it is written. A malformed product fails
 * the ingest loudly rather than rendering an empty page later.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  ARCHIVE,
  CATEGORIES,
  CATEGORY_BLURBS,
  DATA_DIR,
  PRODUCT_IMAGE_WIDTH,
  PUBLIC_DIR,
  SLICE,
  SWATCH_IMAGE_WIDTH,
} from "./config.ts";
import {
  cleanDescription,
  describeImage,
  findDatasheetUrl,
  parseDimensions,
  parseFeatures,
  parseFinish,
  parseFinishSlugs,
  slugify,
  slugifySku,
  type RawProduct,
} from "./parse.ts";
import { fetchDocument, sleep, toWebp } from "./media.ts";
import type {
  CatalogueMeta,
  Category,
  FacetOption,
  Finish,
  FinishFamily,
  Product,
  SearchEntry,
} from "../../src/lib/types.ts";
import { FINISH_FAMILY_NAMES } from "../../src/lib/types.ts";

const problems: string[] = [];
function fail(message: string): void {
  problems.push(message);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/* ── select ─────────────────────────────────────────────────────────── */

interface Candidate {
  dir: string;
  raw: RawProduct;
  category: (typeof CATEGORIES)[number];
}

async function collectCandidates(): Promise<Candidate[]> {
  const productsDir = path.join(ARCHIVE, "products");
  if (!(await exists(productsDir))) {
    throw new Error(
      `Archive not found at ${ARCHIVE}\n` +
        `data/ is committed, so the site still builds without it. Set ` +
        `ELAYA_ARCHIVE to re-run the ingest.`,
    );
  }

  const dirs = await fs.readdir(productsDir);
  const out: Candidate[] = [];

  for (const dir of dirs.sort()) {
    const raw = await readJson<RawProduct>(
      path.join(productsDir, dir, "product.json"),
    );
    // /shop/ is the store archive page, not a product. It is the one folder
    // without a product.json and is expected to be skipped.
    if (!raw?.sku || !raw.name) continue;

    const category = CATEGORIES.find((c) =>
      (raw.categories ?? []).some((x) => x.toLowerCase() === c.source.toLowerCase()),
    );
    if (!category) continue;

    out.push({ dir, raw, category });
  }
  return out;
}

/**
 * Take the quota for each category, preferring products that will exercise
 * the templates: ones with a real image, and a spread of finish counts so the
 * picker is tested against many, few and none.
 */
function selectSlice(candidates: Candidate[]): Candidate[] {
  if (SLICE === null) return candidates;

  const byCategory = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = byCategory.get(candidate.category.source) ?? [];
    list.push(candidate);
    byCategory.set(candidate.category.source, list);
  }

  const chosen: Candidate[] = [];
  for (const [source, quota] of Object.entries(SLICE)) {
    const pool = byCategory.get(source) ?? [];
    if (pool.length === 0) {
      fail(`slice asks for ${quota} from "${source}" but the archive has none`);
      continue;
    }
    // Sort by finish count descending, then interleave from both ends so the
    // slice contains rich and bare products rather than only the rich ones.
    const sorted = [...pool].sort(
      (a, b) => (b.raw.variations?.length ?? 0) - (a.raw.variations?.length ?? 0),
    );
    const picked: Candidate[] = [];
    let head = 0;
    let tail = sorted.length - 1;
    while (picked.length < Math.min(quota, sorted.length)) {
      const next = picked.length % 2 === 0 ? sorted[head++] : sorted[tail--];
      if (next) picked.push(next);
    }
    chosen.push(...picked);
  }
  return chosen;
}

/* ── build ──────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  console.log(`archive: ${ARCHIVE}`);

  const candidates = await collectCandidates();
  console.log(`candidates in mapped categories: ${candidates.length}`);

  const slice = selectSlice(candidates);
  console.log(`selected: ${slice.length}`);

  await fs.rm(path.join(PUBLIC_DIR, "products"), { recursive: true, force: true });
  await fs.rm(path.join(PUBLIC_DIR, "swatches"), { recursive: true, force: true });
  await fs.mkdir(DATA_DIR, { recursive: true });

  // Swatch files live beside the product images in the archive, under names
  // that do not always match the attribute slug. Index them once, loosely.
  const swatchIndex = await indexSwatches();

  const products: Product[] = [];
  const finishSlugs = new Set<string>();
  let datasheetsFound = 0;

  for (const { dir, raw, category } of slice) {
    const sku = raw.sku!.trim();
    const slug = slugifySku(sku);
    const description = cleanDescription(raw.description);
    const dimensions = parseDimensions(description);

    // The product's own sub-category is the useful "type": "Above Counter
    // Washbasin" rather than the shouted top-level "WASHBASINS".
    const typeName =
      (raw.categories ?? []).find(
        (c) => c.toLowerCase() !== category.source.toLowerCase() && /\s/.test(c),
      ) ?? category.name;

    // image
    const imagesDir = path.join(ARCHIVE, "products", dir, "images");
    const files = (await fs.readdir(imagesDir).catch(() => [])) as string[];
    const source = pickLargest(files, sku);
    if (!source) {
      fail(`${sku}: no image in the archive`);
      continue;
    }

    let image;
    try {
      const out = path.join(PUBLIC_DIR, "products", `${slug}.webp`);
      const result = await toWebp(path.join(imagesDir, source), out, PRODUCT_IMAGE_WIDTH);
      image = {
        src: `/products/${slug}.webp`,
        width: result.width,
        height: result.height,
        alt: describeImage(raw.name!, typeName, dimensions),
      };
    } catch (error) {
      fail(`${sku}: image conversion failed (${String(error).slice(0, 80)})`);
      continue;
    }

    // datasheet
    let datasheet: string | null = null;
    const rawHtml = await fs
      .readFile(path.join(ARCHIVE, "products", dir, "raw.html"), "utf8")
      .catch(() => "");
    const url = rawHtml ? findDatasheetUrl(rawHtml) : null;
    if (url) {
      const out = path.join(PUBLIC_DIR, "docs", `${slug}.pdf`);
      if (await fetchDocument(url, out)) {
        datasheet = `/docs/${slug}.pdf`;
        datasheetsFound += 1;
      }
      await sleep(250); // their WAF rate-limited the original crawl
    }

    const finishes = parseFinishSlugs(raw);
    for (const f of finishes) finishSlugs.add(f);

    const materials = [
      ...new Set(
        finishes
          .map((f) => parseFinish(f)?.family)
          .filter((f): f is FinishFamily => Boolean(f)),
      ),
    ];

    products.push({
      sku,
      slug,
      name: raw.name!.trim(),
      categorySlug: category.slug,
      categoryName: category.name,
      type: { slug: slugify(typeName), name: typeName },
      dimensions,
      description,
      features: parseFeatures(description),
      image,
      finishes,
      materials,
      datasheet,
    });
  }

  products.sort((a, b) => a.name.localeCompare(b.name) || a.sku.localeCompare(b.sku));

  /* finishes actually referenced by the slice */
  const finishes: Finish[] = [];
  for (const slug of [...finishSlugs].sort()) {
    const parsed = parseFinish(slug);
    if (!parsed) {
      fail(`finish "${slug}" does not match the code pattern and was dropped`);
      continue;
    }
    // Try the exact slug, then fall back to the colour code alone. The code
    // is the part that is never wrong: eleven slugs disagree with their own
    // filenames, including "burshed" for brushed and a stray "-2" suffix.
    const swatchSource =
      swatchIndex.get(normalise(slug)) ??
      swatchIndex.get(parsed.code.toLowerCase());
    let image: string | null = null;
    if (swatchSource) {
      try {
        await toWebp(
          swatchSource,
          path.join(PUBLIC_DIR, "swatches", `${slug}.webp`),
          SWATCH_IMAGE_WIDTH,
        );
        image = `/swatches/${slug}.webp`;
      } catch {
        // leave null; the UI marks a missing swatch rather than faking one
      }
    }
    finishes.push({ ...parsed, image });
  }

  /* categories, counted from the built data rather than asserted */
  const fullCounts = await countFullCatalogue();
  const categories: Category[] = CATEGORIES.map((c) => {
    const mine = products.filter((p) => p.categorySlug === c.slug);
    return {
      slug: c.slug,
      name: c.name,
      blurb: CATEGORY_BLURBS[c.slug] ?? null,
      count: mine.length,
      totalInCatalogue: fullCounts.get(c.source) ?? mine.length,
      image: c.image ? `/rooms/${c.image}` : null,
      icon: c.icon ? `/icons/${c.icon}` : null,
      productTypes: tally(mine.map((p) => [p.type.slug, p.type.name])),
      materials: tally(
        mine.flatMap((p) => p.materials.map((m) => [m, FINISH_FAMILY_NAMES[m]] as const)),
      ) as FacetOption<FinishFamily>[],
      finishes: [...new Set(mine.flatMap((p) => p.finishes))].sort(),
    };
  }).filter((c) => c.count > 0);

  const search: SearchEntry[] = products.map((p) => ({
    s: p.slug,
    n: p.name,
    k: p.sku,
    t: p.type.name,
    c: p.categoryName,
  }));

  const meta: CatalogueMeta = {
    generatedAt: new Date().toISOString().slice(0, 10),
    products: products.length,
    productsInCatalogue: 596,
    categoriesInCatalogue: 50,
    finishesInCatalogue: 87,
  };

  validate(products, categories, finishes);

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  await write("products.json", products);
  await write("categories.json", categories);
  await write("finishes.json", finishes);
  await write("search.json", search);
  await write("meta.json", meta);

  console.log(
    `\nwrote ${products.length} products, ${categories.length} categories, ` +
      `${finishes.length} finishes`,
  );
  console.log(
    `swatches: ${finishes.filter((f) => f.image).length}/${finishes.length} · ` +
      `datasheets: ${datasheetsFound}/${products.length}`,
  );
}

/* ── helpers ────────────────────────────────────────────────────────── */

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * WordPress writes several sizes of the same shot into one folder:
 * `E05-AC40029.png`, `-600x600.png` and `-50x50.png`. Taking the first match
 * alphabetically picks the 50px thumbnail, which is how four accessories
 * originally came through the pipeline as unusable 50x50 product images.
 *
 * Prefer the unsuffixed original, then the largest suffixed variant.
 */
function pickLargest(files: string[], sku: string): string | undefined {
  const mine = files.filter((f) =>
    f.toLowerCase().startsWith(sku.toLowerCase()),
  );
  const pool = mine.length > 0 ? mine : files;
  if (pool.length === 0) return undefined;

  const area = (file: string): number => {
    const match = /-(\d+)x(\d+)\.[a-z]+$/i.exec(file);
    if (!match) return Number.MAX_SAFE_INTEGER; // no suffix means the original
    return Number(match[1]) * Number(match[2]);
  };

  return [...pool].sort((a, b) => area(b) - area(a))[0];
}

/** The client's swatch filenames disagree with their own attribute slugs in
 *  eleven places, including real typos (COFFE, FR09, MOUTAIN, EMPRADOR). A
 *  normalised key catches most; the rest fall back to a prefix match on the
 *  colour code, which is the part that is never wrong. */
async function indexSwatches(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const roots = ["products", "product-categories", "product-brands", "pages"];
  for (const root of roots) {
    const base = path.join(ARCHIVE, root);
    for (const dir of await fs.readdir(base).catch(() => [])) {
      const imagesDir = path.join(base, dir, "images");
      for (const file of await fs.readdir(imagesDir).catch(() => [])) {
        if (!/-50x50/i.test(file)) continue;
        const key = normalise(file.replace(/-50x50.*$/i, ""));
        if (!index.has(key)) index.set(key, path.join(imagesDir, file));
      }
    }
  }
  // second pass: index by colour code alone, e.g. "m04"
  for (const [key, file] of [...index]) {
    const code = /^([a-z]+\d+)/.exec(key)?.[1];
    if (code && !index.has(code)) index.set(code, file);
  }
  return index;
}

async function countFullCatalogue(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const base = path.join(ARCHIVE, "products");
  for (const dir of await fs.readdir(base).catch(() => [])) {
    const raw = await readJson<RawProduct>(path.join(base, dir, "product.json"));
    for (const c of raw?.categories ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts;
}

function tally(pairs: ReadonlyArray<readonly [string, string]>): FacetOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const [value, label] of pairs) {
    const entry = counts.get(value) ?? { label, count: 0 };
    entry.count += 1;
    counts.set(value, entry);
  }
  return [...counts.entries()]
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Guards against the failure mode that matters: a record that type-checks
 *  but renders as an empty page. */
function validate(
  products: Product[],
  categories: Category[],
  finishes: Finish[],
): void {
  const slugs = new Set<string>();
  const finishSlugs = new Set(finishes.map((f) => f.slug));
  const categorySlugs = new Set(categories.map((c) => c.slug));

  for (const p of products) {
    if (slugs.has(p.slug)) fail(`duplicate product slug "${p.slug}"`);
    slugs.add(p.slug);
    if (!p.name) fail(`${p.sku}: empty name`);
    if (!p.description) fail(`${p.sku}: empty description`);
    if (!p.image.src || p.image.width < 200) fail(`${p.sku}: image too small or missing`);
    if (!p.image.alt) fail(`${p.sku}: no alt text`);
    if (!categorySlugs.has(p.categorySlug)) {
      fail(`${p.sku}: category "${p.categorySlug}" has no entry`);
    }
    for (const f of p.finishes) {
      if (!finishSlugs.has(f)) fail(`${p.sku}: references unknown finish "${f}"`);
    }
  }
  if (products.length === 0) fail("no products survived ingest");
  if (categories.length === 0) fail("no categories survived ingest");
}

async function write(name: string, value: unknown): Promise<void> {
  await fs.writeFile(
    path.join(DATA_DIR, name),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

await main();
