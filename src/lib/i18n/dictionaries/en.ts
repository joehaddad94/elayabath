/**
 * Every string the interface says, in one place.
 *
 * Values are strings, never functions. A dictionary crosses into client
 * components, and a function cannot be serialised across that boundary; it
 * also has to survive becoming a JSON file when a second language arrives.
 * Anything with a variable in it uses a {named} placeholder and goes through
 * `format()`.
 *
 * Two kinds of text live here and they are not the same thing:
 *
 *   - Interface labels, written for this build. "Request a quote" does not
 *     exist anywhere on the live site; the commercial model needed a label
 *     and this is it. All of these need client approval.
 *
 *   - The client's own copy, reproduced verbatim, punctuation quirks intact:
 *     the capital M in "Myth", the curly apostrophes, the stray space in
 *     "ELAYA BATH ,". Do not tidy these. They are marked `verbatim`.
 *
 * Anything drafted by us that reads as the client's voice is marked `draft`
 * and is rendered with a visible warning.
 */

const en = {
  brand: {
    name: "Elaya Bath",
    /** verbatim — the homepage slogan. The About page uses an ungrammatical
     *  variant, "Because Bathroom's Matters"; this is the canonical one. */
    tagline: "Because Bathrooms Matter",
  },

  nav: {
    label: "Primary",
    home: "Home",
    about: "About Us",
    products: "Products",
    catalogue: "Catalogue",
    contact: "Contact Us",
    search: "Search products",
    palette: "Palette",
    skipToContent: "Skip to content",
  },

  footer: {
    assistance: "Need assistance?",
    technical: "Technical Assistance:",
    design: "Design Assistance:",
    general: "General Inquiry:",
    formPrompt: "Or fill in the",
    formLink: "contact form",
    company: "Our Company",
    legal: "Legal Area",
    follow: "Follow Us",
    faq: "FAQ",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    returns: "Returns & Refunds",
    copyright: "Copyright © 2026 Elaya",
  },

  contactAddresses: {
    technical: "Salessupport@elayabath.com",
    design: "Design@elayabath.com",
    general: "Info@elayabath.com",
    /** A different company's domain. The regional office for the Middle East
     *  and Africa trades as Aqua Elite UAE. Flagged for the client. */
    mea: "info@aquaeliteuae.com",
    europe: "info@elayabath.com",
  },

  common: {
    breadcrumb: "Breadcrumb",
    requestQuote: "Request a quote",
    requestQuoteFor: "Request a quote for {sku}",
    browseProducts: "Browse the products",
    shopTheSelection: "Shop the selection",
    downloadCatalogue: "Download the catalogue",
    itemCode: "Item code",
    dimensions: "Dimensions",
    productType: "Product type",
    features: "Features",
    finishes: "Finishes",
    material: "Material",
    colour: "Colour",
    dataSheet: "Technical data sheet",
    noneRecorded: "Not published",
    products: "Products",
    categories: "Categories",
    viewAll: "View all",
    of: "of",
  },

  home: {
    /** verbatim — the About Us paragraph, which the homepage also uses. */
    lede:
      "ELAYA BATH was founded with a vision to revolutionize the sanitary ware industry by merging innovative technology with stunning design.",
    /** verbatim — the four-item product list, kept as a list rather than
     *  flattened into prose the way the live homepage flattens it. */
    plateIntro: "Our brand offers a diverse range of products.",
    plateItems: [
      "Elegantly crafted accessories",
      "Advanced showers",
      "Stylish toilets",
      "Luxurious bathtubs.",
    ],
    plateFoot:
      "Each product is thoughtfully designed to elevate daily experiences and cater to the evolving needs of our customers.",
    /** verbatim — the pull quote, capital M and curly quotes intact. */
    quote: "‘All toilets look the same’, is a widely believed Myth.",
    quoteAttribution: "Elaya Bath",
    productsLabel: "Products",
    productsMeta: "{shown} of {total} categories",
  },

  products: {
    title: "Products",
    intro:
      "The live site drops you into an unfiltered grid of every item, fifteen at a time. Choosing a category first is the difference between forty pages of scrolling and one filtered shelf.",
    startWithCategory: "Start with a category",
    inThisBuild: "in this build",
    inCatalogue: "in the full catalogue",
    knowTheCode: "Know the code?",
    knowTheCodeBody:
      "Every item carries a code like E02-SW40034. If you have it from a drawing, a data sheet or the catalogue, skip the browsing.",
  },

  category: {
    filters: "Filter products",
    clearAll: "Clear all",
    showing: "Showing {shown} of {total}",
    noResults:
      "Nothing matches that combination. Clear a filter to widen the results.",
    swatchNote:
      "Finish swatches are photographs of the real material and will vary slightly from the finished product. Ask for a physical sample with your quote.",
    noSwatch: "n/a",
  },

  product: {
    finishCount: "Finish — {n} available",
    noFinishes:
      "Supplied in one finish only. No finish options are recorded for this item.",
    selected: "Selected",
    quoteHeading: "Request a quote",
    quoteBody:
      "No prices are published. Send the item code and the finish you want, and we come back with pricing, lead time and availability.",
    related: "Other products in this category",
    datasheetMissing:
      "Referenced by the live site, but the file could not be retrieved.",
  },

  search: {
    title: "Search",
    placeholder: "Product name or item code",
    label: "Search products",
    resultsFor: "Results for “{q}”",
    noResults: "Nothing found. Try an item code, or browse by category.",
    hint: "Search by product name, item code, type or category.",
  },

  notFound: {
    title: "Page not found",
    body: "That page does not exist. The products are a good place to start.",
  },

  draft: {
    badge: "Draft",
    needsApproval: "Needs client approval",
    needsLegalReview: "Draft. Needs legal review before launch",
  },
} as const;

export default en;
export type Dictionary = typeof en;
