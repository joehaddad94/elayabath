# Elaya Bath

A rebuild of [elayabath.com](https://elayabath.com) in Next.js, with a dashboard at `/admin` where
Elaya's staff manage the catalogue.

Elaya Bath sells sanitaryware: washbasins, toilets, tapware, bathtubs, showers and
accessories. The commercial model is **browse then quote**. No prices are published, there is
no basket and nothing is sold through the site. Every product page ends in a request for a
quotation carrying the item code.

Build progress is tracked in [MILESTONES.md](./MILESTONES.md) (the site) and
[CMS-PLAN.md](./CMS-PLAN.md) (the dashboard). How to set up, run, back up and move it is in
[RUNBOOK.md](./RUNBOOK.md).

## Running it

```bash
npm install
npm run db:start   # local Supabase (Docker Desktop)
npm run seed       # the catalogue into it
npm run dev        # http://localhost:3000, dashboard at /admin
npm run check      # types, lint, tests, audits, database tests, build. The gate before pushing
```

Node 20 or newer. Next 16 uses Turbopack by default. The full setup, including
`.env.local`, is in [RUNBOOK.md](./RUNBOOK.md).

## Why it is built this way

**Cached pages over a database.** The catalogue is 596 products with no prices, no stock and
no personalisation, so visitors never need a live query. It lives in Supabase (Postgres, Auth,
Storage), where staff edit it; saving a change puts it live. Each page is built once from the
published copy and cached, and a save refreshes only the pages it touches. Visitors get static pages;
staff get a dashboard; nothing is redeployed to change a product.

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
    catalogue.ts         the only module that reads the catalogue (the published copy)
    types.ts             the shape of a product, category and finish
    i18n/                dictionary, locale config
    admin/               the dashboard's schemas, queries, publishing, import and export
    supabase/            clients: public, server (as the staff member), admin, browser
  styles/
    system.css           Industry design system, vendored unchanged
    themes/              stone.css, ink.css. Palettes only, no layout
    globals.css
```

Three rules keep this from rotting:

1. **Pages never read the database directly.** They go through `lib/catalogue.ts`, which is
   why moving the catalogue from JSON to Supabase changed no page.
2. **`scripts/ingest/` is the only code that knows the source archive exists.** Everything
   downstream sees clean typed records.
3. **Client components never import `lib/catalogue.ts`.** It is server-only; shared logic
   both sides need lives in a data-free module instead. This rule predates the database: when
   the catalogue was JSON, one such import put a 45 KB chunk of product records in front of
   every visitor who opened search.

## Checking the work

`npm run check` runs everything: types, lint, tests, the static audit, the
database tests (`supabase/tests/`, including every access rule) and a
production build. The database tests need the local stack running.

**Tests** (`npm test`, Vitest) cover pure logic only: parsing, ranking,
grouping, formatting. Every case is a real record from the client's catalogue
rather than an invented one, because the parsing exists precisely because
their data is inconsistent, and testing it against tidy input would prove
nothing.

**The static audit** (`npm run audit`) needs no dependencies and no browser.
Each check is there because that rule was broken once, silently:

| Check | The failure it catches |
| --- | --- |
| muted text meets the contrast floor | five styles drifted to 50-60% after 65% had already been established by measurement |
| no hard-coded colours in the page layer | a hex that ignores the theme and only shows up in one palette |
| client components never reach the catalogue | `lib/catalogue.ts` imports every JSON at module scope, so one import from a `"use client"` file ships 45 KB of product records to the browser |
| no unused dictionary keys | a string nothing renders, that a translator would still be paid for |
| no unused exports | usually a helper that was duplicated inline somewhere instead |
| no font weight loaded but never painted | three of five weights were downloading for nothing |
| data files in step with the code | a product referencing an image or data sheet that is not on disk |

**The browser audit** (`npm run audit:browser`) measures what the static one
cannot: contrast against the pixels actually painted behind each text node,
horizontal overflow at 1440 and 390, broken images, alt text, heading order
and landmarks. Its routes come from the catalogue, so widening the slice
widens the audit with it.

**The dashboard audit** (`npm run audit:admin`) runs the same checks on every
dashboard screen, signed in, and **the load test** (`npm run load`) imports
6,000 products and times the grid at ten times the catalogue.

Playwright is deliberately not a dependency: it pulls a few hundred megabytes
of browser binaries for a tool run occasionally. Install it when you want it:

```bash
npm i --no-save playwright && npx playwright install chromium
npm run build && npm start          # one terminal
npm run audit:browser               # another
```

## Search

Search runs in the database (`public.search_catalogue`), so a visitor never
downloads an index. Matching is deliberately exact rather than fuzzy: the people it has to serve most are
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
reads it and stages all 596 products; `npm run seed` loads them into Supabase and publishes
what is live on the old site. Records are validated as they are staged, so a malformed product
fails there instead of rendering an empty page. From then on the catalogue is edited in the
dashboard.

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

## The dashboard

At `/admin`, for Elaya's staff: a products list (every product at once, instant search, a Visible switch) with
bulk actions, a product editor with gallery, data sheet, finishes, preview
and history, categories, finishes, the homepage order, import and export of
Excel and CSV, media and an activity feed. Every change is a draft until it
is published. The design is in [CMS-PLAN.md](./CMS-PLAN.md), with what each
milestone found; running it is in [RUNBOOK.md](./RUNBOOK.md).
