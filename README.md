# Elaya Bath

A rebuild of [elayabath.com](https://elayabath.com) as a statically generated Next.js site.

Elaya Bath sells sanitaryware: washbasins, toilets, tapware, bathtubs, showers and
accessories. The commercial model is **browse then quote**. No prices are published, there is
no basket and nothing is sold through the site. Every product page ends in a request for a
quotation carrying the item code.

Build progress is tracked in [MILESTONES.md](./MILESTONES.md).

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build, prerenders every route
npm run lint
npm run typecheck
npm run ingest     # regenerate data/ from the source archive
```

Node 20 or newer. Next 16 uses Turbopack by default.

## Why it is built this way

**Static, from generated JSON.** The catalogue is 596 products with no prices, no stock and no
personalisation. Nothing on the site needs to be live, so nothing is: an ingest script turns
the source archive into typed JSON committed to the repo, and every route is prerendered at
build time. There is no database to run, no API to keep up, and the whole site can be served
from a CDN. Content changes are a commit.

**The design system is CSS, not a framework.** The two palettes were contrast-audited before
this repo existed. Re-expressing them as utility classes would have risked that work for no
gain, so the system ships as vendored CSS custom properties and each component gets a CSS
Module that reads those tokens. Switching theme is one attribute on `<html>`, with no React
re-render.

**Localised in shape, English in content.** Arabic is a likely future requirement and
retrofitting routing is expensive, so routes sit under a locale segment, UI strings live in a
dictionary, and layout uses logical properties (`margin-inline`, `padding-block`). Only
English is built, and the locale is not visible in URLs until a second one exists.

## Folder structure

```
data/                    generated, committed. The catalogue as typed JSON
scripts/ingest/          archive -> data/. The only thing that knows about the scrape
public/
  products/              one optimised WebP per product
  swatches/              finish swatches
  rooms/                 room photography
  docs/                  per-product technical data sheets
src/
  app/
    [locale]/            every page. Locale hidden from URLs while there is one
    sitemap.ts
    robots.ts
  components/            one folder per component: Thing.tsx + Thing.module.css
  lib/
    catalogue.ts         the only module that reads data/. Pages never import JSON
    types.ts             the shape of a product, category and finish
    i18n/                dictionary, locale config
    search.ts
  styles/
    system.css           Industry design system, vendored unchanged
    themes/              stone.css, ink.css. Palettes only, no layout
    globals.css
```

Two rules keep this from rotting:

1. **Pages never import from `data/` directly.** They go through `lib/catalogue.ts`, so the
   storage decision can change later without touching a single page.
2. **`scripts/ingest/` is the only code that knows the source archive exists.** Everything
   downstream sees clean typed records.

## Search

The search index is emitted by the ingest alongside the catalogue and loaded
with a dynamic import, so it becomes its own chunk fetched the first time
someone opens search rather than weight every other visitor carries. Matching
is deliberately exact rather than fuzzy: the people it has to serve most are
specifiers arriving with an item code from a drawing, and fuzzy matching a
code turns a precise query into a list of near misses.

## One route is not static

Everything is prerendered except `[locale]/[...rest]`, which exists only to
catch unmatched URLs and call `notFound()`. Without it an unmatched path falls
through to Next's built-in 404, which has no layout at all: no header, no
footer, no fonts, no theme.

Even with it, Next serves a 404 inside its own error document
(`<html id="__next_error__">`), which replaces the root layout's `<html>` and
therefore carries no `data-theme` or `lang`. That is why the Ink palette is
declared on bare `:root` as well as on its attribute selector: an un-themed
document still has to render in a palette the site actually uses.

## Data

The catalogue comes from a full crawl of the live site held outside this repo. `npm run ingest`
reads it and writes `data/*.json`. Records are validated as they are written, so a malformed
product fails the build instead of rendering an empty page.

v1 ships a **50-product slice spread across categories**, which exercises every template,
filter and edge case. Widening it to all 596 is a constant in the ingest config, not a rewrite.

## Things wrong with the source data

Inherited from the live site, reproduced faithfully, and reported rather than silently fixed:

- **Prices are placeholders.** 592 of 596 products carry `1 QAR`. No real pricing exists.
- **Four advertised categories have no products**: Bathroom Furniture, Shower Trays, Shower
  Enclosures, Installation Systems. They are in the live site's own navigation.
- **The catalogue PDF 404s.** The live site links to `CATALOGUE-ELAYA.pdf`; the file is gone.
  The per-product data sheets do still exist and are pulled into `public/docs/`.
- **Two SKUs are two codes in one field**, for a basin and pedestal sold as a pair. They are
  slugged for URLs; the real fix is two records in their data.
- **Eleven colour slugs disagree with their own swatch filenames**, including `COFFE`, `FR09`,
  `MOUTAIN` and `EMPRADOR`. Names follow the slug, so their typos are visible rather than
  quietly corrected.

## Licence and content

Product imagery, copy and catalogue data belong to Elaya Bath.
