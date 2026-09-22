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

  faq: {
    title: "Questions",
    lede:
      "Materials, installation and water efficiency. If the answer is not here, the enquiry form reaches a person.",
    realHeading: "Answered by Elaya Bath",
    realNote: "These three are reproduced word for word from the live site.",
    draftHeading: "Questions the site raises",
    draftLabel: "Drafted, not yet approved",
    draftNote:
      "Elaya Bath has not published answers to these. The wording below is a proposal based on how the site actually works and must be confirmed before it goes live. The three answers above are theirs; these three are not.",
    /** verbatim — the only three questions the live site answers. */
    real: [
      {
        q: "What materials are your products made of?",
        a: "Our products are crafted using high-quality, durable materials such as ceramic, porcelain, and stainless steel. Each item is designed to combine functionality with a modern aesthetic to suit both residential and commercial spaces.",
      },
      {
        q: "Do you offer installation services?",
        a: "Yes, we provide professional installation services for all our products. Our trained experts ensure quick and hassle-free setup. Contact us for details about installation in your area",
      },
      {
        q: "Are your products water-efficient?",
        a: "Many of our toilets, urinals, and washbasins are designed with water-saving features to promote sustainability without compromising performance. Look for our eco-friendly models labeled as water-efficient.",
      },
    ],
    /** draft — three questions the site's own structure provokes and leaves
     *  unanswered. Every visitor who reaches a product page and finds no
     *  price asks the first one. */
    drafted: [
      {
        q: "Why are there no prices?",
        a: "Pricing depends on finish, quantity and destination, so every price is quoted rather than listed. Send the item code from any product page and we come back with pricing, lead time and availability.",
      },
      {
        q: "Can I get a physical sample of a finish?",
        a: "Yes. The finish swatches shown on each product page are photographs of the real material and will vary slightly from the finished product. Ask for a sample when you send your enquiry and mention the finish code, for example SS13.",
      },
      {
        q: "Where do I find technical drawings?",
        a: "Each product has a technical data sheet listing dimensions, outlet position and installation requirements. It is named after the item code and can be downloaded from the product page.",
      },
    ],
  },

  about: {
    title: "About Us",
    /** verbatim — the whole of the live About page's copy. */
    products: "Products",
    categories: "Categories",
    finishesLabel: "Finishes",
    productsNote: "Every item carries its own code, dimensions and finish range.",
    categoriesNote:
      "From washbasins and bathtubs to urinals, kitchen and accessories.",
    finishesNote:
      "Across ceramic, solid surface, resin, marble, concrete and plated metal.",
    workingHeading: "Specify, then ask",
    workingBody:
      "There are no prices on this site. Find the item, send the code, and the right person comes back to you with pricing, lead time and availability.",
  },

  contact: {
    title: "We are local all over the world",
    regionalLabel: "Regional contacts",
    regionalHeading: "Who covers your market",
    /** verbatim — from the live contact-form page. */
    regionalBody:
      "For all inquiries, after sales or distribution requests, write to the regional address or use the form below.",
    meaRegion: "MEA & Africa",
    europeRegion: "Europe & US",
    technicalRegion: "Technical",
    designRegion: "Design",
    generalRegion: "General",
    regionalOffice: "Regional office",
    technicalHeading: "Technical assistance",
    designHeading: "Design assistance",
    generalHeading: "General inquiry",
    meaBody: "Middle East, Africa and distribution enquiries for the region.",
    europeBody: "Europe and United States enquiries, including specification support.",
    technicalBody: "Specification, installation, dimensions and technical data sheets.",
    designBody: "Finishes, colour combinations and physical samples.",
    generalBody: "Anything that does not belong with the other two.",
    sendEmail: "Send an e-mail",
    formLabel: "Enquiry form",
    formHeading: "Ask about a product",
    formBody:
      "There are no prices on this site. Send the item code and we come back with pricing, lead time and availability.",
    prototypeLabel: "Prototype",
    prototypeBody:
      "This form is not wired to a backend in this build. It validates and reveals the trade fields, but submitting it does nothing.",
    fType: "What is this about?",
    fName: "Your name",
    fEmail: "E-mail address",
    fCountry: "Country",
    fCountryHint: "So the enquiry reaches the right regional office.",
    fSku: "Item code",
    fSkuHint: "Shown on every product page. Separate several with commas.",
    fCompany: "Company or project",
    fQty: "Approximate quantity",
    fMessage: "Message",
    fConsent:
      "I agree that Elaya Bath may use these details to respond to this enquiry.",
    submit: "Send enquiry",
    carried: "Item {sku} has been added to this enquiry.",
    types: {
      quote: "A price for a specific product",
      trade: "Trade and projects, for multiple items or volume",
      technical: "Technical support or data sheets",
      design: "Design assistance, finishes and samples",
      distribution: "Distribution or becoming a stockist",
      other: "Something else",
    },
  },

  catalogue: {
    title: "The catalogue",
    lede:
      "The full range in one document, or browse the same products here with filters and item codes.",
    heading: "Elaya Catalogue",
    body:
      "Every product, grouped by category, with item codes, dimensions and the finish range for each piece. The same codes work in the enquiry form.",
    download: "Download the PDF",
    browseInstead: "Browse online instead",
    missingLabel: "File missing from their server",
    missingBody:
      "The live site links to CATALOGUE-ELAYA.pdf from its homepage, its catalogue page and its PDF viewer. That file returns 404. The download below is deliberately inert until the client supplies the document.",
    sheetsHeading: "Technical data sheets",
    sheetsBody:
      "Separate from the catalogue, each item has its own sheet with dimensions, outlet position and installation requirements. These do still exist and are downloadable from every product page.",
    findProduct: "Find a product",
  },

  legal: {
    onThisPage: "On this page",
  },

  draft: {
    needsApproval: "Needs client approval",
    needsLegalReview: "Draft. Needs legal review before launch",
  },
} as const;

export default en;
export type Dictionary = typeof en;
