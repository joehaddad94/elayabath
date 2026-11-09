/**
 * What the dashboard's Site content tab can edit, page by page, and how an
 * edit reaches the site.
 *
 * Every editable item has a key. Text keys are paths into the dictionary
 * (`home.lede` is `en.home.lede`), so the original wording is simply the
 * dictionary's, and an item nobody has edited costs nothing. Photos, SEO and
 * the few things that are not dictionary text have keys of their own.
 *
 * Shared by the dashboard (to draw and check the fields) and the site (to
 * apply the edits), so it holds no server code.
 */
import { z } from "zod";
import en, { type Dictionary } from "@/lib/i18n/dictionaries/en";
import { PHOTOS, type Photo, type PhotoKey } from "@/lib/imagery";
import { storageUrl } from "@/lib/supabase/config";

/* ── the registry ────────────────────────────────────────────────────── */

export interface TextField {
  kind: "text" | "textarea" | "lines" | "email" | "url";
  key: string;
  label: string;
  max: number;
  hint?: string;
  /** Where else this same text appears, shown beside the field. */
  shared?: { label: string; page?: PageSlug };
}

export interface PhotoField {
  kind: "photo";
  key: `photo.${string}`;
  label: string;
  fallback: PhotoKey;
  /** Runs the full width of the screen, so it has to be wide. */
  wide: boolean;
}

export type Special = { kind: "tiles" } | { kind: "homeProducts" } | { kind: "faq" } | { kind: "counts" };

export type Item = TextField | PhotoField | Special;

export interface Group {
  heading: string;
  note?: string;
  items: Item[];
}

export const PAGE_SLUGS = ["home", "about", "catalogue", "contact", "faq", "products", "category", "footer"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export interface SitePage {
  slug: PageSlug;
  title: string;
  /** Where it is on the site, for "Open the page". */
  path: string;
  intro?: string;
  /** Where the text the intro mentions is edited. */
  introLink?: { page: PageSlug; label: string };
  groups: Group[];
  /** The page's own title and description for search engines. */
  seo?: { title: string; description: string };
}

/** Full-width photos below this look soft on an ordinary desktop screen. */
export const WIDE_MIN_WIDTH = 1400;
/** Any other photo. */
export const PHOTO_MIN_WIDTH = 600;
/** Google shows about this much of a title and a description. */
export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;

export const HOME_PRODUCTS_MAX = 12;

const text = (key: string, label: string, max = 120, extra: Partial<TextField> = {}): TextField => ({
  kind: "text", key, label, max, ...extra,
});
const area = (key: string, label: string, max = 600, extra: Partial<TextField> = {}): TextField => ({
  kind: "textarea", key, label, max, ...extra,
});
const photo = (key: `photo.${string}`, label: string, fallback: PhotoKey, wide = true): PhotoField => ({
  kind: "photo", key, label, fallback, wide,
});

const ON_ABOUT = { label: "Also on About Us", page: "about" as const };
const IN_FOOTER = { label: "Also in the footer", page: "footer" as const };

export const SITE_PAGES: SitePage[] = [
  {
    slug: "home",
    title: "Homepage",
    path: "/",
    groups: [
      {
        heading: "Hero",
        note: "The first screen of the site.",
        items: [
          text("brand.tagline", "Headline", 80, {
            shared: ON_ABOUT,
            hint: "Also the About Us heading and its closing quote, which sets the word “Matter” in italics. Wording without “Matter” shows no italics there.",
          }),
          area("home.lede", "Introduction", 400, { shared: ON_ABOUT }),
          text("home.plateIntro", "Range list: opening line", 160, { shared: ON_ABOUT }),
          { kind: "lines", key: "home.plateItems", label: "Range list: items, one per line", max: 80, shared: ON_ABOUT },
          area("home.plateFoot", "Range list: closing line", 300, { shared: ON_ABOUT }),
          photo("photo.home.hero", "Background photo", "contactBanner"),
        ],
      },
      {
        heading: "Quote",
        items: [
          text("home.quote", "Quote", 160, { hint: "If it contains “Myth.”, that word is set in italics." }),
          text("home.quoteAttribution", "Attributed to", 60),
        ],
      },
      {
        heading: "Category tiles",
        note: "A category shows here once it has a description and a photo. The description is also the opening line of the category's own page.",
        items: [{ kind: "tiles" }],
      },
      {
        heading: "Full-width band",
        items: [text("home.bandLabel", "Small label", 60), { kind: "counts" }, photo("photo.home.band", "Photo", "shopBanner")],
      },
      {
        heading: "Products on the homepage",
        note: `Up to ${HOME_PRODUCTS_MAX}, in this order. The starred one's photo sits in the hero. A product that is hidden drops off by itself.`,
        items: [{ kind: "homeProducts" }],
      },
    ],
    seo: {
      title: "Elaya Bath — Because Bathrooms Matter",
      description:
        "ELAYA BATH was founded with a vision to revolutionize the sanitary ware industry by merging innovative technology with stunning design.",
    },
  },
  {
    slug: "about",
    title: "About Us",
    path: "/about",
    intro: "The headline, introduction and range list at the top of this page are the Homepage's, edited there.",
    introLink: { page: "home", label: "Edit them on the Homepage." },
    groups: [
      { heading: "Top of the page", items: [photo("photo.about.banner", "Banner photo", "aboutBanner")] },
      {
        heading: "The three numbers",
        note: "The numbers are counted from the catalogue. Only the line under each is text.",
        items: [
          area("about.productsNote", "Under the number of products", 200),
          area("about.categoriesNote", "Under the number of categories", 200),
          area("about.finishesNote", "Under the number of finishes", 200),
        ],
      },
      {
        heading: "Materials",
        items: [
          text("about.materialsLabel", "Small label", 60),
          text("about.materialsHeading", "Heading", 120),
          area("about.materialsBody", "Text", 800),
          area("about.materialsNote", "Note", 300),
          photo("photo.about.materials", "Photo", "materials", false),
        ],
      },
      {
        heading: "Full-width band",
        items: [
          text("about.bandLabel", "Small label", 60),
          text("about.bandHeading", "Heading", 140),
          photo("photo.about.band", "Photo", "shopBanner"),
        ],
      },
      {
        heading: "Closing",
        items: [text("about.workingHeading", "Heading", 120), area("about.workingBody", "Text", 600)],
      },
    ],
    seo: {
      title: "About Us",
      description:
        "ELAYA BATH was founded with a vision to revolutionize the sanitary ware industry by merging innovative technology with stunning design.",
    },
  },
  {
    slug: "catalogue",
    title: "Catalogue",
    path: "/catalogue",
    groups: [
      {
        heading: "Top of the page",
        items: [
          text("catalogue.title", "Page heading", 80),
          area("catalogue.lede", "Introduction", 400),
          photo("photo.catalogue.banner", "Banner photo", "heroRoom"),
        ],
      },
      {
        heading: "The catalogue",
        items: [
          text("catalogue.heading", "Heading", 120),
          area("catalogue.body", "Text", 800),
          area("catalogue.missingBody", "Note while the PDF is unavailable", 400),
          photo("photo.catalogue.materials", "Photo", "materials", false),
        ],
      },
      { heading: "Full-width band", note: "Its text is shared with the category pages.", items: [photo("photo.catalogue.band", "Photo", "shopBanner")] },
      {
        heading: "Data sheets",
        items: [text("catalogue.sheetsHeading", "Heading", 120), area("catalogue.sheetsBody", "Text", 600)],
      },
    ],
    seo: {
      title: "Catalogue",
      description: "The full Elaya Bath range as one document, plus per-product technical data sheets.",
    },
  },
  {
    slug: "contact",
    title: "Contact Us",
    path: "/contact",
    groups: [
      {
        heading: "Top of the page",
        items: [text("contact.title", "Page heading", 80), photo("photo.contact.banner", "Banner photo", "contactBanner")],
      },
      {
        heading: "Regional contacts",
        items: [
          text("contact.regionalHeading", "Heading", 120),
          area("contact.regionalBody", "Text", 600),
          area("contact.meaBody", "MEA & Africa: text", 300),
          { kind: "email", key: "contactAddresses.mea", label: "MEA & Africa: e-mail", max: 120 },
          area("contact.europeBody", "Europe & US: text", 300),
          { kind: "email", key: "contactAddresses.europe", label: "Europe & US: e-mail", max: 120 },
          area("contact.technicalBody", "Technical: text", 300),
          { kind: "email", key: "contactAddresses.technical", label: "Technical: e-mail", max: 120, shared: IN_FOOTER },
          area("contact.designBody", "Design: text", 300),
          { kind: "email", key: "contactAddresses.design", label: "Design: e-mail", max: 120, shared: IN_FOOTER },
          area("contact.generalBody", "General: text", 300),
          { kind: "email", key: "contactAddresses.general", label: "General: e-mail", max: 120, shared: IN_FOOTER },
        ],
      },
      {
        heading: "Enquiry form",
        items: [
          text("contact.formHeading", "Heading", 120),
          area("contact.formBody", "Text", 600),
          photo("photo.contact.band", "Photo above the form", "aboutBanner"),
        ],
      },
    ],
    seo: {
      title: "Contact Us",
      description: "Regional offices for MEA, Africa, Europe and the US, plus technical, design and general enquiries.",
    },
  },
  {
    slug: "faq",
    title: "FAQ",
    path: "/faq",
    groups: [
      {
        heading: "Top of the page",
        items: [
          text("faq.title", "Page heading", 80),
          area("faq.lede", "Introduction", 400),
          photo("photo.faq.banner", "Banner photo", "aboutBanner"),
        ],
      },
      { heading: "Questions", items: [{ kind: "faq" }] },
      { heading: "Full-width band", note: "Its text is shared with the category pages.", items: [photo("photo.faq.band", "Photo", "contactBanner")] },
    ],
    seo: {
      title: "FAQ",
      description: "Materials, installation and water efficiency: the questions Elaya Bath is asked most.",
    },
  },
  {
    slug: "products",
    title: "Products",
    path: "/products",
    groups: [
      {
        heading: "Top of the page",
        items: [
          text("products.title", "Page heading", 80, { hint: "Also the name of this page in the breadcrumbs on every category and product page." }),
          area("products.intro", "Introduction", 400),
          photo("photo.products.banner", "Banner photo", "shopBanner"),
        ],
      },
      {
        heading: "Know the code?",
        items: [text("products.knowTheCode", "Heading", 80), area("products.knowTheCodeBody", "Text", 400)],
      },
      { heading: "Full-width band", note: "Its heading counts the catalogue.", items: [photo("photo.products.band", "Photo", "contactBanner")] },
    ],
    seo: {
      title: "Products",
      description: "Browse washbasins, toilets, tapware, bathtubs, showers and accessories by category, with item codes and finishes.",
    },
  },
  {
    slug: "category",
    title: "Category pages",
    path: "/products",
    intro: "Shared by every category page. A category's own name and description are edited in Categories, and its tile on the Homepage.",
    groups: [
      {
        heading: "How to specify",
        items: [
          text("category.insetLabel", "Small label", 60),
          text("category.insetHeading", "Heading", 120),
          area("category.insetBody", "Text", 800),
        ],
      },
      {
        heading: "Quote band",
        note: "Also on product pages, the Catalogue and the FAQ.",
        items: [text("category.bandLabel", "Small label", 60), text("category.bandHeading", "Heading", 140)],
      },
    ],
  },
  {
    slug: "footer",
    title: "Footer",
    path: "/",
    intro: "Shown at the bottom of every page. Its three e-mail addresses are the Contact Us page's, edited there. The logo and the page links stay as they are.",
    introLink: { page: "contact", label: "Edit the e-mails on Contact Us." },
    groups: [
      {
        heading: "Need assistance?",
        items: [
          text("footer.assistance", "Heading", 60),
          text("footer.technical", "Label before the technical e-mail", 60),
          text("footer.design", "Label before the design e-mail", 60),
          text("footer.general", "Label before the general e-mail", 60),
          text("footer.formPrompt", "Line before the form link", 80),
          text("footer.formLink", "Form link", 60),
        ],
      },
      {
        heading: "Column headings",
        items: [
          text("footer.company", "Our Company", 60),
          text("footer.legal", "Legal Area", 60),
          text("footer.follow", "Follow Us", 60),
        ],
      },
      {
        heading: "Social links",
        note: "An icon shows only once it has a link. With none set, the Follow Us column is hidden.",
        items: [
          { kind: "url", key: "social.linkedin", label: "LinkedIn", max: 300 },
          { kind: "url", key: "social.youtube", label: "YouTube", max: 300 },
          { kind: "url", key: "social.instagram", label: "Instagram", max: 300 },
          { kind: "url", key: "social.x", label: "X", max: 300 },
          { kind: "url", key: "social.pinterest", label: "Pinterest", max: 300 },
        ],
      },
      {
        heading: "Bottom line",
        items: [text("footer.signature", "Signature", 60), text("footer.copyright", "Copyright", 120)],
      },
    ],
  },
];

export function sitePage(slug: string): SitePage | undefined {
  return SITE_PAGES.find((p) => p.slug === slug);
}

const allItems = SITE_PAGES.flatMap((p) => p.groups.flatMap((g) => g.items));
export const TEXT_FIELDS: ReadonlyMap<string, TextField> = new Map(
  allItems.filter((i): i is TextField => "key" in i && i.kind !== "photo").map((f) => [f.key, f]),
);
export const PHOTO_FIELDS: ReadonlyMap<string, PhotoField> = new Map(
  allItems.filter((i): i is PhotoField => i.kind === "photo").map((f) => [f.key, f]),
);

/** The homepage tiles' photo descriptions as they were written before. */
export const TILE_CAPTIONS: Record<string, string> = {
  toilets:
    "A dark bathroom in black marble and fluted timber, with a backlit round mirror over a black vessel basin and a matt black wall-hung toilet",
  tapware:
    "A brushed-brass three-hole basin mixer running water into a dark basin, shot from above against a black surface",
  washbasins:
    "Six above-counter washbasins grouped against a pale plaster wall, in blue, sage, deep green, dark grey, terracotta and fluted cream",
};

export const tileAltKey = (slug: string) => `home.tileAlt.${slug}`;
export const seoKey = (page: PageSlug, part: "title" | "description") => `seo.${page}.${part}`;
export const HOME_PRODUCTS_KEY = "home.products";
export const HOME_HERO_KEY = "home.heroProduct";
export const FAQ_KEY = "faq.items";

/* ── values ──────────────────────────────────────────────────────────── */

export type SiteContent = Readonly<Record<string, unknown>>;

const storedPath = z.string().regex(/^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_./-]*$/, "That photo isn't a stored file.");

export const photoValue = z.object({
  /** A file in the site-media bucket, or null for the original photo. */
  path: storedPath.nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  alt: z.string().trim().min(1, "Describe the photo for people who can't see it.").max(300, "At most 300 characters."),
});
export type PhotoValue = z.infer<typeof photoValue>;

export const faqValue = z
  .array(
    z.object({
      q: z.string().trim().min(1, "A question needs its wording.").max(200, "At most 200 characters."),
      a: z.string().trim().min(1, "A question needs an answer.").max(2000, "At most 2,000 characters."),
      visible: z.boolean(),
    }),
  )
  .max(40, "At most 40 questions.");
export type FaqItem = z.infer<typeof faqValue>[number];

function textSchema(field: TextField) {
  const one = z.string().trim().min(1, "Empty: choose “Use original wording” instead.").max(field.max, `At most ${field.max} characters.`);
  if (field.kind === "lines") return z.array(one).min(1, "At least one item.").max(8, "At most 8 items.");
  if (field.kind === "email") return z.email("That isn't an e-mail address.").max(field.max);
  if (field.kind === "url") return z.url({ protocol: /^https$/, error: "Paste the full address, starting https://" }).max(field.max);
  return one;
}

/** The check for one key's value, or undefined for a key that isn't editable. */
export function schemaFor(key: string): z.ZodType | undefined {
  const field = TEXT_FIELDS.get(key);
  if (field) return textSchema(field);
  if (PHOTO_FIELDS.has(key)) return photoValue;
  if (key === HOME_PRODUCTS_KEY) return z.array(z.uuid()).max(HOME_PRODUCTS_MAX, `At most ${HOME_PRODUCTS_MAX} products.`);
  if (key === HOME_HERO_KEY) return z.uuid();
  if (key === FAQ_KEY) return faqValue;
  if (/^home\.tileAlt\.[a-z0-9-]+$/.test(key)) return z.string().trim().min(1, "Describe the photo for people who can't see it.").max(300);
  const seo = /^seo\.([a-z]+)\.(title|description)$/.exec(key);
  if (seo && sitePage(seo[1]!)?.seo) return z.string().trim().min(1).max(seo[2] === "title" ? 120 : 400);
  return undefined;
}

/* ── reading the original wording ────────────────────────────────────── */

export function originalText(key: string): string | readonly string[] | undefined {
  let node: unknown = en;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" || Array.isArray(node) ? (node as string | readonly string[]) : undefined;
}

/* ── applying edits ──────────────────────────────────────────────────── */

/**
 * The dictionary with this content's edits in place. Only registered text
 * keys are applied, and only values that pass their check, so a stray or
 * malformed row can never break a page: it shows the original wording.
 */
export function applyText(dictionary: Dictionary, content: SiteContent): Dictionary {
  const out = structuredClone(dictionary) as unknown as Record<string, Record<string, unknown>>;
  for (const [key, field] of TEXT_FIELDS) {
    if (!(key in content)) continue;
    const parsed = textSchema(field).safeParse(content[key]);
    if (!parsed.success) continue;
    const [section, name] = key.split(".") as [string, string];
    if (out[section] && name in out[section]) out[section][name] = parsed.data;
  }
  return out as unknown as Dictionary;
}

/** A photo slot as the site places it: the edited photo, or the original. */
export function photoFor(content: SiteContent, key: `photo.${string}`): Photo {
  const field = PHOTO_FIELDS.get(key);
  const original = PHOTOS[field?.fallback ?? "heroRoom"];
  const parsed = photoValue.safeParse(content[key]);
  if (!parsed.success) return original;
  const { path, width, height, alt } = parsed.data;
  if (!path || !width || !height) return { ...original, alt };
  return { src: storageUrl("site-media", path), width, height, alt };
}

export function seoFor(content: SiteContent, page: PageSlug): { title: string; description: string } {
  const original = sitePage(page)?.seo ?? { title: "", description: "" };
  const pick = (part: "title" | "description") => {
    const value = content[seoKey(page, part)];
    return typeof value === "string" && value.trim() ? value : original[part];
  };
  return { title: pick("title"), description: pick("description") };
}

export function faqFor(content: SiteContent): FaqItem[] | null {
  const parsed = faqValue.safeParse(content[FAQ_KEY]);
  return parsed.success ? parsed.data : null;
}

/** The FAQ as the editor starts it when nobody has edited it: the client's
 *  own answers shown, the drafted ones hidden until they are approved. */
export function originalFaq(): FaqItem[] {
  return [
    ...en.faq.real.map((i) => ({ q: i.q, a: i.a, visible: true })),
    ...en.faq.drafted.map((i) => ({ q: i.q, a: i.a, visible: false })),
  ];
}

export function tileAlt(content: SiteContent, slug: string, name: string): string {
  const value = content[tileAltKey(slug)];
  return typeof value === "string" && value.trim() ? value : (TILE_CAPTIONS[slug] ?? name);
}

/** A category's photo or icon: a site asset under public/, or an upload. */
export function categoryAsset(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("/") || /^https?:/.test(value) ? value : storageUrl("site-media", value);
}
