/**
 * What the ingest reads, what it selects, and where it writes.
 *
 * This is the only file to edit when widening the build past the v1 slice:
 * raise the quotas, or set SLICE to null to take everything.
 */
import path from "node:path";

/** The page-by-page crawl of the live site. Lives outside the repo because it
 *  is 1.1 GB. Override with ELAYA_ARCHIVE when it sits somewhere else. */
export const ARCHIVE =
  process.env.ELAYA_ARCHIVE ??
  "C:/Users/Joe/Desktop/elayabath-revamp/output";

export const REPO = path.resolve(import.meta.dirname, "../..");
export const DATA_DIR = path.join(REPO, "data");
export const PUBLIC_DIR = path.join(REPO, "public");

/**
 * The v1 slice: 50 products spread across categories, so every template,
 * facet and edge case is exercised on real records rather than on one
 * category's worth of near-identical basins.
 *
 * Set to null to ingest the entire catalogue. Nothing else has to change:
 * the pipeline, the templates and the routes are all count-agnostic.
 */
export const SLICE: Record<string, number> | null = {
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
}> = [
  { source: "WASHBASINS", slug: "washbasins", name: "Washbasins", icon: "icon-washbasins.png", image: "room-washbasins.webp" },
  { source: "BATHTUBS", slug: "bathtubs", name: "Bathtubs", icon: "icon-furniture.png" },
  { source: "Tapware", slug: "tapware", name: "Tapware", icon: "icon-tapware.png", image: "room-tapware.webp" },
  { source: "TOILETS", slug: "toilets", name: "Toilets", icon: "icon-toilets.png", image: "room-toilets.webp" },
  { source: "Accessories", slug: "accessories", name: "Accessories" },
  { source: "Showers", slug: "showers", name: "Showers" },
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
