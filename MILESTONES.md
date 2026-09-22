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
