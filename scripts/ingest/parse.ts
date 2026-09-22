/**
 * Turning one scraped product into one clean record.
 *
 * Everything the live site gets wrong is handled here and nowhere else:
 * SKUs that are not URL-safe, descriptions that are one run-on line, colour
 * slugs that disagree with their own swatch filenames, and the prefix that
 * encodes which material a finish belongs to.
 */
import type { FinishFamily } from "../../src/lib/types.ts";
import { FINISH_FAMILY_NAMES } from "../../src/lib/types.ts";

/** Shape of the scraper's output. Deliberately loose: it is untrusted input
 *  and every field is checked before it becomes a Product. */
export interface RawProduct {
  url?: string;
  name?: string;
  sku?: string;
  priceText?: string;
  shortDescription?: string;
  description?: string;
  categories?: string[];
  brand?: string[];
  galleryImages?: string[];
  variations?: Array<{
    sku?: string;
    attributes?: Record<string, string>;
  }>;
}

/**
 * Two of the 596 item codes are two codes in one field, for a basin and
 * pedestal sold as a pair: `E06-SW10353 A+ E06-SW10353 B`. They are not
 * usable in a filename or a URL, so everything addressable uses this.
 */
export function slugifySku(sku: string): string {
  return sku
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The colour code prefix maps one-to-one onto the material. This is the
 *  structure the live site's own filter throws away. */
const FAMILY_BY_PREFIX: Record<string, FinishFamily> = {
  a: "acrylic",
  c: "ceramic",
  cr: "concrete",
  m: "marble",
  p: "plating",
  rt: "resin",
  rf: "resin",
  ss: "solid-surface",
};

export interface ParsedFinish {
  slug: string;
  code: string;
  name: string;
  family: FinishFamily;
  familyName: string;
}

/**
 * `rt12-rf12-yellow-moutain-2` becomes RT12 / "Yellow Moutain" / resin.
 *
 * The resin slugs double-encode their own code, and several carry the
 * client's typos. Names follow the slug rather than being corrected, so the
 * mistakes stay visible to whoever has to fix them at source.
 */
export function parseFinish(slug: string): ParsedFinish | null {
  const match = /^([a-z]+)(\d+)-(.*)$/.exec(slug);
  if (!match) return null;
  const [, prefix = "", digits = "", rest = ""] = match;

  const family = FAMILY_BY_PREFIX[prefix];
  if (!family) return null;

  const name = rest
    .replace(/^(rf|rt)\d+-/, "")
    .replace(/-\d+$/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  if (!name) return null;

  return {
    slug,
    code: `${prefix.toUpperCase()}${digits}`,
    name,
    family,
    familyName: FINISH_FAMILY_NAMES[family],
  };
}

/** The description arrives as one unbroken line with a leading "Description". */
export function cleanDescription(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^Description\s+/i, "")
    .trim();
}

export function parseDimensions(description: string): string | null {
  const match =
    /DIMENSION\s*:?\s*([0-9]+\s*[Xx×]\s*[0-9]+(?:\s*[Xx×]\s*[0-9]+)?)\s*(?:MM)?/i.exec(
      description,
    );
  if (!match?.[1]) return null;
  return `${match[1].replace(/\s*[Xx×]\s*/g, " x ").trim()} mm`;
}

const FEATURES = [
  "WITHOUT TAP HOLE",
  "WITH TAP HOLE",
  "SINGLE TAP HOLE",
  "WITHOUT OVERFLOW",
  "WITH OVERFLOW",
  "CENTER OUTLET",
] as const;

export function parseFeatures(description: string): string[] {
  const upper = description.toUpperCase();
  return FEATURES.filter((feature) => upper.includes(feature)).map((feature) =>
    feature
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  );
}

/** Finish slugs in the order the client lists them, de-duplicated. */
export function parseFinishSlugs(raw: RawProduct): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const variation of raw.variations ?? []) {
    const colour = variation.attributes?.["attribute_pa_colors"];
    if (!colour || seen.has(colour)) continue;
    seen.add(colour);
    out.push(colour);
  }
  return out;
}

/** The technical data sheet URL, taken from the page rather than guessed.
 *  Constructing it from the SKU gets the upload month wrong. */
export function findDatasheetUrl(rawHtml: string): string | null {
  const match =
    /https?:\/\/[^"'\s)\\]*TDS-[^"'\s)\\]*\.pdf/i.exec(
      rawHtml.replace(/\\\//g, "/"),
    );
  return match?.[0] ?? null;
}

/** Generated from what is actually known about the product, because the
 *  source has no alt text for product shots at all. */
export function describeImage(name: string, type: string, dimensions: string | null): string {
  const base = `${name}, ${type.toLowerCase()}`;
  return dimensions ? `${base}, ${dimensions}` : base;
}
