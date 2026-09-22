/**
 * Localisation, structured now and used later.
 *
 * Arabic is a likely requirement and retrofitting routing is expensive, so
 * routes sit under a locale segment from the start and every string lives in
 * a dictionary. Only English is built, and `next.config.ts` rewrites the
 * default locale out of the URL, so visitors see `/about` rather than
 * `/en/about` until there is a second language to distinguish.
 *
 * Adding Arabic is then: add the locale here, add a dictionary, pick a font
 * that has Arabic glyphs (Barlow does not), and drop the rewrite.
 */

export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Writing direction. Layout uses logical properties throughout, so this is
 *  the only switch RTL needs. */
export function directionOf(locale: Locale): "ltr" | "rtl" {
  return locale === "en" ? "ltr" : "rtl";
}

/**
 * Build an href for a locale. While there is one locale the segment is
 * omitted, which matches what the rewrite serves. Once a second exists this
 * starts emitting the prefix and every link updates with it.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (LOCALES.length === 1) return clean;
  return `/${locale}${clean === "/" ? "" : clean}`;
}
