# Elaya Bath — build milestones

A rebuild of elayabath.com as a statically generated Next.js site.

**How this runs:** one milestone per commit on `develop`. Each milestone is self-contained
and leaves the repo in a state that type-checks, lints and builds. `main` gets a release once
the whole thing is approved.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Decisions this build rests on

Settled before any code was written, so they are not re-litigated mid-build.

| Decision | Choice |
| --- | --- |
| Content source | Generated JSON committed to the repo. No database, no CMS. |
| Rendering | Fully static. Every route prerendered at build time. |
| Scope of v1 | Full architecture proven on a **50-product slice**, spread across categories. |
| Styling | The vendored Industry token CSS plus CSS Modules per component. No Tailwind. |
| Themes | **Stone** and **Ink**, defaulting to Ink. Toggle persists per visitor. |
| Enquiry form | UI only. No submit handler in v1. |
| Localisation | Structured for Arabic from day one, English only shipped, locale invisible in URLs. |
| Hosting | Vercel. |
| Testing | Strict TypeScript, ESLint, and ingest validation that fails the build on bad data. |
| Documents | Per-product technical data sheets pulled into the repo. Catalogue PDF is 404 on their server. |
| Analytics | None in v1, which also sidesteps the consent problem the live site has. |

---

## M0 — Foundation `[x]`

Repository, toolchain and the shape everything else drops into.

- Next 16.3.5, React 19, TypeScript, App Router, `src/` directory, no Tailwind
- `develop` branch, remote set to `joehaddad94/elayabath`
- Strict compiler settings beyond the scaffold default
- Folder structure fixed and documented in the README
- Scaffold boilerplate removed

**Done when:** `npm run build` succeeds on an empty shell and the tree has no create-next-app leftovers.

## M1 — Design system and theming `[x]`

The visual foundation, ported from the approved prototype rather than reinvented.

- Industry design system vendored as `src/styles/system.css`, unchanged
- Stone and Ink palettes as `[data-theme]` blocks, both already contrast-audited
- Theme toggle writing `document.documentElement.dataset.theme`, persisted
- No flash of the wrong theme on first paint: the stored choice is applied before first render
- Layout primitives and the blueprint registration-mark component

**Done when:** a page renders in both palettes, the toggle persists across a reload, and there is no flash.

## M2 — Data layer `[x]`

The pipeline that turns the 1.1 GB scrape into a small typed dataset.

- `scripts/ingest/` reads the archive and emits `data/*.json`
- Typed records for products, categories and finishes, validated at ingest
- Bad or incomplete records fail the build rather than rendering blank
- 50 products selected across categories, with their images optimised to WebP
- Technical data sheets fetched per product
- A search index emitted alongside the data

**Done when:** `npm run ingest` regenerates every data file deterministically and the build type-checks against them.

## M3 — App shell `[x]`

Everything that wraps a page.

- `[locale]` routing with English only and the segment hidden from URLs
- UI strings in a dictionary, never inline in components
- Header, navigation, footer, skip link, breadcrumbs
- Logical properties throughout so RTL is a flip, not a rewrite
- Metadata defaults, favicon, `robots.ts`, `sitemap.ts`

**Done when:** every route renders inside the shell with correct metadata and no hardcoded UI string.

## M4 — Homepage `[x]`

- Full-bleed room hero with the recovered photography
- The four category blocks with their verbatim copy
- Product grid, finish rail, closing sections
- Motion respecting `prefers-reduced-motion`

**Done when:** it matches the approved prototype in both palettes.

## M5 — Catalogue browsing `[x]`

- `/products` category directory with real counts
- `/products/[category]` listing
- Filters: product type, material, and colour grouped by material with every swatch named
- Filter state in the URL so a filtered view is linkable
- Empty and no-results states

**Done when:** filters work, are linkable, and the counts come from the data rather than being written by hand.

## M6 — Product detail `[x]`

- `/product/[sku]` generated for all 50
- Image that actually renders, unlike the live site
- Finish picker built from real variation data, grouped by material
- Specification table and technical data sheet download
- Quote call to action carrying the item code
- Related products

**Done when:** all 50 prerender, including the zero-variant and two-codes-in-one-field edge cases.

## M7 — Content pages `[x]`

- About, Contact, FAQ, Catalogue
- Real copy verbatim; anything drafted stays visibly marked
- Contact form UI with the item code carried from a product page, no submit handler

**Done when:** all four render and the only invented copy is labelled as such.

## M8 — Legal pages `[x]`

- Privacy, Terms, Returns, carried over with their draft banners intact
- Bracketed placeholders for facts only the client can supply
- Section navigation

**Done when:** all three render and every page states it needs legal review.

## M9 — Search and quality pass `[x]`

- Client-side search over the prebuilt index, by name, item code, type and category
- Accessibility pass: landmarks, headings, focus states, contrast
- Performance pass: image sizing, font loading, no layout shift
- `sitemap.ts` covering every generated route
- Final type, lint and build gate

**Done when:** the build is clean, search works, and the accessibility checks that were run on the prototype pass here.

**Result:** 71 routes build, 65 prerendered as HTML. Audited at 1440px and
390px in both palettes across 19 routes: zero horizontal overflow, zero broken
images, every image with alt text, one h1 per page, no heading level skips,
all four landmarks present, a title and meta description everywhere.

Three defects found by that audit and fixed:

- every category page skipped from h1 to h3, because the filter panel and the
  product cards both used h3 with no h2 between them
- an unmatched URL fell through to Next's built-in 404 with no site shell
- that 404 then rendered in the design system's steel defaults, a palette used
  nowhere else on the site, because Next's error document carries no
  `data-theme`. Declaring Ink on bare `:root` fixed it, and qualifying Stone
  with `:root` keeps it winning on specificity rather than import order, which
  is what silently broke the Stone palette on the first attempt.

---

## Post-build audit

Run after M9, against a production build, measuring rather than reading.

**Contrast.** Every rendered text node measured against the background actually
painted behind it, on ten routes in both palettes. Five styles were below their
4.5:1 floor, all in components written for this repo, all from using 50-60%
muted text where the prototype had already established 65% as the floor: facet
counts (3.93:1), the finish-group counts, the "n/a" swatch marker (3.00:1) and
the breadcrumb separator (2.35:1). All raised. Now clean.

The first version of that measurement reported every style on the site as
failing at about 1.14:1, which was the script and not the site: `color-mix()`
serialises as `color(srgb 0.92 0.91 0.89)`, floats rather than bytes, so a
hand-written parser reads near-white as near-black. Colours are now resolved by
painting them to a canvas.

**Client bundle.** `lib/catalogue.ts` imports every catalogue JSON at module
scope. Routing the search index through it, to honour the rule that nothing
reads `data/` directly, put a 45 KB chunk of product records into the browser
bundle. The loader moved to `lib/search.ts`, which imports no data statically.
Client JS 741 KB to 700 KB, and nothing carries catalogue records now.

**Fonts.** Three of five weights were loaded and never painted. A product page
now requests one font file instead of five.

**Dead code.** Two unused dictionary keys, two unused exports, and three
`data-*` attributes on every product card left over from the prototype's DOM
filtering, which React replaced.

**Duplication.** Finish-grouping was implemented twice inline and a third time
unused in `catalogue.ts`; consolidated into `lib/finishes.ts`. The category page
still carried its own copy of the page-heading CSS after `PageHead` existed.

**Missing boundary.** No `error.tsx`, so an unhandled render error dropped the
visitor onto Next's own error screen with no header, footer, fonts or theme:
the same defect the 404 had before M9. Added.

---

## Closing the audit's own gaps

The audit above found seven defects and fixed them, but left three things it
had relied on and not kept.

**Tests.** Vitest, 38 tests over the pure logic: SKU slugging including the
two-codes-in-one-field pair, finish parsing including the resin slugs that
double-encode their own code and the typos preserved rather than corrected,
dimension extraction including the unicode multiplication sign, search
ranking, finish grouping and string formatting. No component tests: nothing
here has render behaviour the types and the browser audit do not already
cover, and a jsdom harness would be more machinery than the coverage is worth.

**The audit scripts are in the repo.** They were in a scratch directory,
having caught five contrast failures and a bundle leak, which is exactly the
kind of tool that should not live somewhere disposable. Split in two, on the
principle that the always-on check should cost nothing:

- `npm run audit` is static, needs no dependencies, and is part of
  `npm run check`. Seven checks, each one encoding a rule that was broken
  silently at least once. Verified by deliberately reintroducing four of those
  violations and confirming each is caught and the exit code gates.
- `npm run audit:browser` measures rendered pixels and needs Playwright, which
  is deliberately not a dependency. Its routes are derived from the catalogue
  rather than listed, so the audit widens when the slice does.

**Data sheet weight.** Left in the repo as agreed, with the ingest and the
audit now reporting the number and projecting it to the full catalogue
(10 MB today, about 121 MB at 596), so the decision arrives with evidence
rather than as a surprise.

One thing changed along the way: `@types/node` was pinned at `^20` by the
scaffold while the project runs on Node 24. Bumped to `^24`.

---

## Whole-site audit

Eighteen routes, both palettes, measured in a real browser across dimensions
the earlier passes never covered: duplicate ids, accessible names, form
labels, target size, reflow at 320px, reduced motion, image delivery and
search metadata.

**Clean on the first pass**, and worth recording because each one is a way
sites usually break: no duplicate ids, every interactive element has an
accessible name, every form control has a label, no heading-order or landmark
problems, nothing overflows at 320px, and nothing animates when the visitor
has asked for reduced motion.

Three areas did have findings, all now fixed.

- **Target size (WCAG 2.2 SC 2.5.8).** Header navigation sat at 23px, product
  card titles at 22px, the datasheet link at 23px and footer links at 17px.
  All were whatever height the line box happened to be. The inline exception
  covers a link inside a sentence; it does not cover a stacked list, which is
  what a footer is. Every one now states a 24px minimum. Checkboxes went from
  15px to 18px inside their labels.

- **Search metadata.** No page carried a canonical link, and no page carried
  structured data of any kind. Both are now in `lib/seo.ts`: a canonical on
  every route, `Organization` and `WebSite` sitewide, `Product` and
  `BreadcrumbList` on product pages, `CollectionPage` on categories, and
  `FAQPage` on the FAQ. Category descriptions ran to 272-296 characters and
  were truncated mid-sentence in results; they are now clamped to a whole
  sentence under 160.

  Two claims are deliberately withheld. `Product` carries **no `offers`**,
  because the only price in the source data is the placeholder `1 QAR`, and
  the `FAQPage` carries **only the three answers the client published** - the
  three drafted ones on the same page are marked unapproved, and structured
  data would strip that caveat.

- **Image delivery.** The logo was served at 256px and painted at 62. Its
  `sizes` hint described its intrinsic width rather than its rendered one.

Two notes on method. The first run reported the whole site failing, which was
the audit talking to a server left running from an earlier session and still
serving the previous build; the results only became meaningful once it was
restarted. That accident did useful work, though: it is the evidence that the
new checks are not vacuous, since it produced exactly the failures they exist
to catch. All of them are now folded into `scripts/audit/browser.ts` and run
with `npm run audit:browser`.

---

## Inner-page design pass

The whole-site audit was correctness, accessibility and SEO. It said nothing
about design, and a separate look found that the design work had effectively
stopped at the homepage.

The measurement that made it plain: `PhotoBand`, `PullQuote`, `FinishRail`
and `CategoryBlock` were each used on exactly one page, the homepage. Every
other page was the same skeleton, a head then one band then content, and
three of them carried no photograph at all. Category pages were the worst
case, and they are the pages that sell: 3575px of uninterrupted product grid
with no photography and no rhythm.

What changed.

- **`lib/imagery.ts`** now holds every photograph with its real dimensions and
  one agreed alt text. Dimensions were being retyped from memory at each call
  site and the same image described itself differently on different pages.
- **Category pages** open on a photograph instead of a text band, and carry an
  editorial block, a finish rail, a photo band and a row of the other
  categories. The editorial block surfaces the client's own second and third
  blurb paragraphs, which were sitting in the data and had never been painted.
- **`EditorialBlock`** is a new contained photo-and-copy shape. The archive has
  four photographs wide enough to run full-bleed and six that are not; the
  narrow ones now have a placement where their size is an asset instead of
  being stretched.
- **Product, products, about, contact, catalogue and FAQ** all gained a break.
  Every page on the site now carries photography; the FAQ and the category
  pages previously carried none.
- **`Hero` takes breadcrumbs**, so a photographic head can replace `PageHead`
  without dropping the trail.

Three of the six categories have no photograph of their own and borrow one
that genuinely contains the product: bathtubs the frame with the bath, showers
the frame with the shower column, accessories the frame with the towel rail.
That is a content gap for the client, not a design decision.

### Two measurement lessons

**The over-photo blind spot.** Every contrast check reads the CSS background
behind an element, which over a photograph is the wrong answer, so those
regions are marked `[data-over-photo]` and skipped. That meant every hero
heading, every breadcrumb in a plate and every `PhotoBand` was unmeasured, and
this pass added a great deal more text into exactly those regions. The backdrop
cannot be sampled from a plain screenshot either: inside a text node's box most
pixels are the glyphs, and sampling those reports a flawless 1:1 for
white-on-dark. The audit now hides the text, keeping layout, and samples the
photograph underneath. It immediately found the breadcrumb on the washbasins
hero at 4.20:1 against a 4.5 floor, because a compact plate puts its content
around 29% down, in the weakest part of a veil tuned for the tall homepage
hero. The compact variant got its own stronger veil.

**`--space-5` does not exist.** The scale runs 1, 2, 3, 4, 6, 8. An undefined
custom property makes the whole declaration invalid, so
`padding: var(--space-4) var(--space-5)` computed to zero padding while the
border and grid on the same element applied normally. The row just looked
tight. It passed the build, the lint, the type check and the browser audit,
and was only caught by looking at a screenshot. There is now a static check
that every custom property a stylesheet uses is defined somewhere, including
the ones `next/font` generates rather than writing into CSS.

---

## Deliberately not in v1

Listed so they read as decisions rather than oversights.

- The other 546 products. The pipeline scales by changing one number.
- A working enquiry backend.
- Arabic content.
- Cart, checkout, wishlist and customer accounts. The model is browse then quote.
- An admin interface. Content changes are a commit.
- Analytics.

## Known content gaps, inherited from the live site

These belong to the client, not the build.

- Four categories are advertised in their navigation with **no products behind them**: Bathroom Furniture, Shower Trays, Shower Enclosures, Installation Systems.
- The catalogue PDF the live site links to returns **404**.
- Every product carries the placeholder price `1 QAR`. No real pricing exists anywhere.
- Two SKUs are two item codes in one field, for a basin and pedestal pair.
- Eleven colour slugs disagree with their own swatch filenames, including several typos.
- Some photography is credited to an outside designer and is not Elaya's own product.
