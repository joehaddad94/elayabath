import { DEFAULT_LOCALE, localePath, type Locale } from "./i18n/config";

/**
 * Every internal URL the site can produce, in one place.
 *
 * Nothing builds an href by string concatenation at the call site. That is
 * what makes adding a locale prefix, or changing the product URL shape, a
 * one-file change rather than a search-and-replace across every component.
 */
export const routes = {
  home: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/"),
  about: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/about"),
  contact: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/contact"),
  faq: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/faq"),
  catalogue: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/catalogue"),
  products: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/products"),
  category: (slug: string, l: Locale = DEFAULT_LOCALE) =>
    localePath(l, `/products/${slug}`),
  product: (slug: string, l: Locale = DEFAULT_LOCALE) =>
    localePath(l, `/product/${slug}`),
  search: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/search"),
  privacy: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/legal/privacy"),
  terms: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/legal/terms"),
  returns: (l: Locale = DEFAULT_LOCALE) => localePath(l, "/legal/returns"),
  /** A quote enquiry for one item, with the code carried across. The live
   *  site's form has no field for this, so an enquiry arrives with no way to
   *  tell what it is about. */
  quote: (sku: string, l: Locale = DEFAULT_LOCALE) =>
    `${localePath(l, "/contact")}?product=${encodeURIComponent(sku)}#enquiry`,
} as const;
