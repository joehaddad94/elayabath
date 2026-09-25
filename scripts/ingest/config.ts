/**
 * What the ingest reads, what it selects, and where it writes.
 *
 * Two modes, chosen by environment variable:
 *
 *   npm run ingest
 *     The site's own data: the 50-product slice, written into data/ and
 *     public/, committed. Unchanged from before the database existed.
 *
 *   INGEST_OUT=.seed INGEST_SLICE=all npm run ingest
 *     Seed mode: the whole catalogue, written into a gitignored staging
 *     folder that scripts/seed loads into Supabase. Gaps (a product with no
 *     photo, no description) are recorded rather than failing the run,
 *     because the plan imports gaps as gaps and lets staff fix them.
 */
import path from "node:path";

/** The page-by-page crawl of the live site. Lives outside the repo because it
 *  is 1.1 GB. Override with ELAYA_ARCHIVE when it sits somewhere else. */
export const ARCHIVE =
  process.env.ELAYA_ARCHIVE ??
  "C:/Users/Joe/Desktop/elayabath-revamp/output";

export const REPO = path.resolve(import.meta.dirname, "../..");

/** Where output goes. The repo by default; a staging folder in seed mode. */
export const OUT = process.env.INGEST_OUT
  ? path.resolve(REPO, process.env.INGEST_OUT)
  : REPO;
export const SEED_MODE = OUT !== REPO;

export const DATA_DIR = path.join(OUT, "data");
export const PUBLIC_DIR = path.join(OUT, "public");

/**
 * The v1 slice: 50 products spread across categories, so every template,
 * facet and edge case is exercised on real records rather than on one
 * category's worth of near-identical basins.
 *
 * Set to null to ingest the entire catalogue. Nothing else has to change:
 * the pipeline, the templates and the routes are all count-agnostic.
 */
export const SLICE: Record<string, number> | null = process.env.INGEST_SLICE === "all" ? null : {
  WASHBASINS: 10,
  BATHTUBS: 9,
  Tapware: 9,
  TOILETS: 8,
  Accessories: 7,
  Showers: 7,
};

/**
 * The client's category names are inconsistent: some shout, some do not, and
 * several exist twice at different levels of the tree. This maps the ones
 * worth surfacing onto a stable slug and a presentable name.
 */
export const CATEGORIES: ReadonlyArray<{
  source: string;
  slug: string;
  name: string;
  icon?: string;
  image?: string;
  /** Seeded unpublished, for staff to publish when they choose. Never in the
   *  site's own slice, which takes only the categories in SLICE. */
  draft?: boolean;
}> = [
  { source: "WASHBASINS", slug: "washbasins", name: "Washbasins", icon: "icon-washbasins.png", image: "room-washbasins.webp" },
  { source: "BATHTUBS", slug: "bathtubs", name: "Bathtubs", icon: "icon-furniture.png" },
  { source: "Tapware", slug: "tapware", name: "Tapware", icon: "icon-tapware.png", image: "room-tapware.webp" },
  { source: "TOILETS", slug: "toilets", name: "Toilets", icon: "icon-toilets.png", image: "room-toilets.webp" },
  { source: "Accessories", slug: "accessories", name: "Accessories" },
  { source: "Showers", slug: "showers", name: "Showers" },
  // The 56 products the six categories above do not cover. Decided
  // 2026-09-24: seeded as five new categories, as drafts.
  { source: "SHOWER TOILETS", slug: "shower-toilets", name: "Shower Toilets", draft: true },
  { source: "URINALS", slug: "urinals", name: "Urinals", draft: true },
  { source: "Kitchen", slug: "kitchen", name: "Kitchen", draft: true },
  { source: "BIDETS", slug: "bidets", name: "Bidets", draft: true },
  { source: "ADA", slug: "accessible", name: "Accessible", draft: true },
];

/**
 * The only category copy the client has ever written, reproduced verbatim,
 * including the capital M in "Myth", the curly quotes and the stray space in
 * "ELAYA BATH ,". Do not tidy these.
 */
export const CATEGORY_BLURBS: Record<string, string[]> = {
  toilets: [
    "\u2018All toilets look the same\u2019, is a widely believed Myth.",
    "ELAYA BATH is here to change that for you. When designing and curating an aesthetically pleasing bathroom, the toilet is a fundamental factor that may enhance your bathroom.",
    "From vintage to sleek, to modern, to earthy\u2026 ELAYA BATH can assure you that not only will we meet your stylistic standards, but we will bring forward impeccable functionality.",
  ],
  tapware: [
    "Tapware is underrated. You\u2019ll see it from every time you wash your hands to every time you get ready, they\u2019re essential for everyday use. Making sure that your faucet reflects and meets your dream ambience is key, and ELAYA BATH is here to help deliver looks and function.",
  ],
  washbasins: [
    "A washbasin is more than just a functional element in your bathroom, it\u2019s a centerpiece that defines style and utility. Whether sleek and minimalist or bold and artistic, the right washbasin can elevate the entire aesthetic of your space while offering the practicality you need for everyday use.",
    "At ELAYA BATH , we craft washbasins that blend form and function seamlessly, ensuring they not only meet your design expectations but also enhance your daily rituals with effortless sophistication.",
  ],
};

/** Widths the product image is actually rendered at, largest first. */
export const PRODUCT_IMAGE_WIDTH = 800;
export const SWATCH_IMAGE_WIDTH = 96;
export const WEBP_QUALITY = 82;
