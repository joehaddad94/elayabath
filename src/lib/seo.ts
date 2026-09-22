import type { Category, Product } from "./types";
import { SITE_ORIGIN } from "./site";

/**
 * Search-engine surface: canonical URLs and structured data.
 *
 * Two reasons this is one module rather than inline objects on each page.
 *
 * The first is that a canonical URL is only useful if every page has one and
 * they all agree. Scattering `alternates` across a dozen page files is how a
 * site ends up with one page canonicalising to a staging host.
 *
 * The second is that structured data makes claims on the company's behalf. A
 * wrong claim in JSON-LD is worse than no claim: Google acts on it. Keeping
 * the builders here means every claim the site makes is reviewable in one
 * file, and the notes about what is deliberately *not* claimed stay next to
 * the code that would otherwise claim it.
 */

/** Relative, so `metadataBase` resolves it. A literal origin here would be a
 *  second source of truth for something `lib/site.ts` already owns. */
export function canonical(path: string) {
  return { canonical: path } as const;
}

const abs = (path: string) => new URL(path, SITE_ORIGIN).toString();

/** The publisher. Referenced by @id from every other node so the graph is
 *  connected rather than a pile of unrelated objects. */
export const ORG_ID = `${SITE_ORIGIN}/#organization`;

export function organizationSchema(emails: {
  general: string;
  technical: string;
  design: string;
}) {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "Elaya Bath",
    url: SITE_ORIGIN,
    logo: abs("/logo.png"),
    description:
      "Sanitary ware and bathroom fittings: washbasins, toilets, tapware, bathtubs, showers and accessories.",
    // No `address` and no `telephone`. The live site publishes neither a
    // street address nor a phone number, and inventing one to satisfy a
    // rich-result validator would put a false fact in front of buyers.
    contactPoint: [
      { "@type": "ContactPoint", contactType: "sales", email: emails.general },
      {
        "@type": "ContactPoint",
        contactType: "technical support",
        email: emails.technical,
      },
      { "@type": "ContactPoint", contactType: "customer support", email: emails.design },
    ],
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    url: SITE_ORIGIN,
    name: "Elaya Bath",
    publisher: { "@id": ORG_ID },
  };
}

export function productSchema(product: Product, url: string) {
  return {
    "@type": "Product",
    name: `${product.name} ${product.sku}`,
    sku: product.sku,
    mpn: product.sku,
    url: abs(url),
    image: abs(product.image.src),
    description: product.description || undefined,
    category: product.categoryName,
    brand: { "@type": "Brand", name: "Elaya Bath" },
    // Deliberately no `offers`. 592 of the client's 596 products carry a
    // placeholder price of 1 QAR in their own data, and the site quotes
    // rather than sells. Emitting an `offers` block would either publish that
    // placeholder as a real price or invent one. Product schema is valid
    // without it; it simply will not earn a price rich result, which is the
    // correct outcome until the client supplies real pricing.
    ...(product.dimensions ? { size: product.dimensions } : {}),
  };
}

export function categorySchema(category: Category, url: string, productUrls: string[]) {
  return {
    "@type": "CollectionPage",
    name: category.name,
    url: abs(url),
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: productUrls.length,
      itemListElement: productUrls.map((href, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: abs(href),
      })),
    },
  };
}

export function breadcrumbSchema(trail: { name: string; href?: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      ...(step.href ? { item: abs(step.href) } : {}),
    })),
  };
}

/** Only ever called with the three answers the client actually published.
 *  The FAQ page also carries three drafted answers marked as unapproved; they
 *  are not eligible, because structured data would present a proposal as the
 *  company's stated position. */
export function faqSchema(entries: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.q,
      acceptedAnswer: { "@type": "Answer", text: e.a },
    })),
  };
}

/** The longest a meta description can be before a result page truncates it
 *  mid-word. Not a standard, an observation about rendered width; 160 is the
 *  figure the field has settled on. */
export const DESCRIPTION_LIMIT = 160;

/**
 * Shortens a description to something a search result can show whole.
 *
 * Prefers a sentence break, because a description ending at a full stop reads
 * as written rather than cut. Falls back to a word break with an ellipsis,
 * and returns short text untouched.
 */
export function clampDescription(text: string, limit = DESCRIPTION_LIMIT) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;

  const sentence = clean.slice(0, limit + 1).lastIndexOf(". ");
  // A single trailing sentence fragment is worse than a clean cut, so only
  // take the sentence break if it leaves a description worth showing.
  if (sentence >= limit * 0.5) return clean.slice(0, sentence + 1);

  const word = clean.slice(0, limit - 1).lastIndexOf(" ");
  return `${clean.slice(0, word > 0 ? word : limit - 1).trimEnd()}…`;
}
