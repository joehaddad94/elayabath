# Product dashboard: implementation plan

A dashboard at `/admin` where Elaya staff manage products, categories and the
finish library, with drafts, publishing, full history and Excel import and
export. Planned now, built after the site design is approved.

Status: **planned, not started.** Milestones are at the bottom; tick them off
the same way as `MILESTONES.md`.

---

## Decisions

Agreed with Joe on 2026-09-24. Each one is a choice between real alternatives,
so the reason is kept next to it.

| Topic | Decision | Why |
|---|---|---|
| Editors | A few Elaya staff, equal rights | No roles or approval chain to build. Concurrent editing has to be handled instead (see Conflicts). |
| Platform | Custom dashboard on Supabase: Postgres, Auth, Storage | One vendor for data, sign-in and files. Joe already runs Supabase for Invoice Desk. No licence, and the editing screens can be shaped to finishes and item codes rather than configured around them. |
| Scope | Products, categories, the finish library | Site copy, photography and the enquiries inbox are out of scope for now. |
| Publishing | Draft, then Publish, with a preview | Edits stay private until published. |
| Plan | Supabase free tier, with safeguards | Fits comfortably (see Costs). The free tier pauses idle projects and has no backups; a nightly job covers both. |
| Accounts | Joe's Supabase account while building, a separate Elaya account at deployment | Everything must be reproducible from the repo. Nothing is configured by hand in the Supabase console. |
| Media | Supabase Storage | Same vendor. Measured need at 596 products is about 150 MB against a 1 GB limit. |
| Seed | All 596 products from the scrape | Gaps are imported as gaps and flagged, never invented. |
| Bulk | Excel import and export | Import always shows a preview of what will change before writing anything. |
| Finishes | Options now, room for variants later | See "How the old site modelled finishes". |
| Sign-in | Email magic link, invitation only | No passwords to leak or reset. |
| Arabic | Product data stays English only | Arabic, when it comes, covers site copy, which already lives in the dictionaries. |
| Prices | None | Quote-only stays the model. The `1 QAR` placeholders are not imported. |
| History | Every published version kept, with author and time, restorable | Several people with equal rights need an undo. |
| Location | `/admin` on the same Next.js app | One deploy, shared types, and publishing can invalidate pages directly. |
| Images | An ordered gallery per product | The first image is the card image. |
| Discontinued | Hidden from grids, menus and search; the page stays with a notice and similar products | Old links and search rankings survive. |
| URL changes | Old URLs redirect permanently to new ones | Links in emails, PDFs and search results keep working. |
| Completeness | Warn, never block | The catalogue can go live with its gaps and improve over time. |
| Ordering | Manual order within a category, plus a featured flag for the homepage | |
| Phone | Desktop first, usable on a phone for viewing and small edits | Bulk import and gallery work expect a laptop. |

### How the old site modelled finishes

The WooCommerce site had a full variant structure: 596 products carried 3,729
variations on two axes, colour and material. In practice they were empty:

| per variation | out of 3,729 |
|---|---|
| its own item code | 0 |
| a real price | 0 (every one is `1`) |
| dimensions filled in | 0 |
| its own photo | 18 |
| stock | all "1 in stock", a placeholder |

So finishes are modelled as options: one product, one item code, a list of
finishes drawn from a shared library. The link table between products and
finishes has nullable columns for a per-finish photo and code, so a finish can
take either later without a migration. The 18 per-finish photos from the old
site can use that column from the start.

---

## Architecture

### Today

`scripts/ingest` reads the scrape and writes `data/*.json`. Pages read those
files only through `src/lib/catalogue.ts`, and every product page is
prerendered at build time. Editing a product means re-running the ingest,
committing and redeploying.

### After

```
  Staff browser                     Supabase                    Public visitor
  ─────────────                     ────────                    ──────────────
  /admin  ── magic link ──────────▶ Auth
    │
    │ Server Actions (staff session,
    │ row-level security enforced)
    ▼
  working tables  ◀── edits ──────  Postgres  ────── published ─────▶ lib/catalogue.ts
  (drafts)                            │         read model             │
    │                                 │                                ▼
    └── Publish ──▶ snapshot + revision            cached pages, invalidated
                    + invalidate pages ───────────▶ only for what changed
  uploads ── signed URL, direct ──▶ Storage ──────── next/image ──────▶ images
```

Three rules carry over from the README and one is added:

1. Pages never read the data store directly. `lib/catalogue.ts` stays the only
   public read path. Its function names and return types do not change; they
   become `async`.
2. Client components never import `lib/catalogue.ts`.
3. The ingest script is the only code that knows the scrape exists. After the
   seed it is retired: removed from the build, kept in git history.
4. **New:** the Supabase service-role key never reaches the running app. The
   app uses the visitor's or the staff member's own session, so row-level
   security is what enforces access. The service key exists only in the seed
   script and the nightly job.

### Drafts, publishing and history

The working tables are the drafts. Publishing a product:

1. writes an immutable snapshot of it into `revisions`, with author and time;
2. upserts it into the published read model the public site reads;
3. records a redirect if its slug changed;
4. invalidates the pages that show it: its own page, its category, the
   products index, the homepage if featured, the search index and the sitemap.

Restoring a version copies that snapshot back into the working tables as a
draft. It goes live only when published again, so a restore can be checked
first. Categories and finishes follow the same pattern, through the same
`revisions` table.

**Preview** uses Next's draft mode: a staff-only route switches it on and the
product page then reads the working copy instead of the published one.

### Caching and invalidation

Next 16 offers two ways to refresh only what changed, and one needs checking
before the build starts (milestone C0):

- **Tags** (`'use cache'` with `cacheTag`, invalidated with `updateTag` from a
  Server Action). Precise, and the direction Next is going. It requires turning
  on `cacheComponents`, which changes how the whole app renders.
- **Paths** (`revalidatePath` for each affected route). Works with the site as
  it is today. Less precise, but the list of affected routes is small and
  known.

Default: tags, if C0 shows that enabling `cacheComponents` does not force wide
changes to the public site. Otherwise paths. Either way, pages stay static and
fast; only the pages a publish touches are rebuilt, on their next visit.

Products published after a deploy are rendered on first request and cached
from then on, so a new product never needs a rebuild.

### Conflicts

With equal rights, two people will sometimes open the same product. Each row
carries a version number. Saving checks it; if someone else saved in the
meantime, the editor sees who and when, and chooses to reload or overwrite. No
silent last-write-wins.

---

## Data model

```
categories        id, slug, name, blurb text[], position, status,
                  version, updated_at, updated_by
product_types     id, slug, name, category_id
finishes          id, slug, code (unique), name, family, swatch_path, status
products          id, sku (unique), slug (unique), name, category_id, type_id,
                  description, dimensions, features text[], datasheet_path,
                  status (draft | active | discontinued), featured, position,
                  version, created_at, updated_at, updated_by
product_finishes  product_id, finish_id, position,
                  image_path null, code_override null     ← room for variants
product_images    id, product_id, path, alt, caption, position, width, height
revisions         id, entity_type, entity_id, snapshot jsonb,
                  published_by, published_at
published_*       the read model the public site reads (one row per entity,
                  a snapshot of its last published revision)
redirects         from_slug (unique), product_id, created_at
staff             email, invited_by, created_at
```

- `family` is a check constraint mirroring `FinishFamily` in `src/lib/types.ts`,
  so the site and the database cannot disagree about what a family is.
- Material facets stay derived from finish families, as now.
- `status = draft` means never published. Only drafts can be deleted; anything
  that has been live is discontinued instead, so its URL keeps working.

### Access

| who | can |
|---|---|
| anyone | read the published read model; read the three public buckets |
| an invited staff member, signed in | read and write working tables; publish; upload |
| nobody through the app | use the service-role key |

Signups are disabled. A staff member exists only once someone adds their email
to `staff`, which is what the magic-link check consults.

---

## Media

Three public buckets: `product-media`, `datasheets`, `swatches`.

**Uploads go straight from the browser to Storage** through a signed upload
URL, not through a Server Action. Vercel caps a function's request body at a
few megabytes, and a phone photo is often larger.

**Photos are downscaled in the browser before upload**, to 1600px on the long
edge, as WebP. The product page paints at most 595px, so 1600 covers a 2x
screen with room to spare. Without this, four full-size phone photos per
product across 596 products would run to several gigabytes, well past the free
tier. next/image still produces every smaller size on demand.

**Orphans**: an image uploaded to a draft that is never published, or removed
from a gallery, is cleaned up by the nightly job after seven days.

The Supabase host goes into `images.remotePatterns`, read from an environment
variable so that moving to Elaya's account is a configuration change.

---

## Dashboard

Desktop first. Every screen works on a phone for reading, small edits and
hiding a product.

- **Products**: search by name or code; filter by category, status and
  completeness; bulk publish and bulk hide.
- **Product editor**: all fields, finishes picked from the library, the
  gallery (upload, reorder, caption, alt text), data sheet upload, status,
  featured flag, completeness panel, Preview, Publish, and a History tab
  showing each version with a diff and a Restore button.
- **Category view**: drag products into order; name, slug and blurb
  paragraphs.
- **Finish library**: code, name, family, swatch. Shows how many products use
  each finish. A finish in use cannot be deleted, only retired.
- **Needs attention**: products missing an image, a type, dimensions, a
  description, a data sheet or any finish, worst first. At the current 50, 24
  have no dimensions; the figure across all 596 will be known after the seed.
- **Import and export**.
- **Activity**: who published what, when, from `revisions`.

Built with the site's own tokens and CSS Modules, so it looks like part of the
same product. Radix primitives for dialogs, menus and toasts, where getting
focus handling right by hand is not worth it, and dnd-kit for drag ordering.
Both load only under `/admin`, never on public pages.

### Completeness score

Image, product type, dimensions, description, data sheet, at least one
finish: six checks, shown as a score and as the list of what is missing. It
never blocks publishing.

---

## Import and export

- **Export**: the working copy or the published catalogue to `.xlsx`, one row
  per product, finishes as a comma-separated list of codes. Library: `exceljs`
  (the `xlsx` package on npm is years out of date; the maintained SheetJS build
  is not published there).
- **Import**: upload a sheet, and the server matches rows by item code and
  shows a preview: new, changed (field by field), unchanged, and rows with
  errors (unknown category, unknown finish code, duplicate code). Nothing is
  written until someone confirms. Imported changes land as drafts, so they go
  live only when published.
- Images are not imported from Excel. That can come later as a URL column if
  it turns out to be needed.

---

## Seeding

1. Re-run the ingest with the slice quotas removed, so it covers all 596
   products, and with the per-finish photos kept.
2. A one-off `scripts/seed` loads the result into Supabase and uploads the
   media. Measured: about 8 MB of product images, about 134 MB of data
   sheets, about 1 MB of swatches and room photography. The scrape itself is
   735 MB, but that is WordPress's many resized copies of each photo; only one
   optimised image per product is kept.
3. Everything is imported as published, since it is already live on the old
   site. Placeholder prices are dropped.
4. **Parity check**: the public site rendered from the database must match the
   site rendered from the JSON, page for page, for the 50 products it shows
   today. Only then is the JSON read path removed.
5. The known data problems from the scrape (colour slugs that disagree with
   their own filenames, two SKUs holding two codes in one field) are listed
   under Needs attention for staff to decide on, rather than fixed silently.

---

## Safeguards on the free tier

One nightly GitHub Actions job does both:

- **Keep-alive**: the free tier pauses a project after a week with no
  activity. The public site is cached, so it could go a week without touching
  the database, after which the dashboard would stop working. The nightly job
  queries the database, which counts as activity.
- **Backup**: the free tier has no backups. The job exports every table, and
  the published catalogue as JSON, and commits them to a `catalogue-backup`
  branch. That is an off-platform copy, and it also lets the site build from a
  snapshot if Supabase is ever down.

The service-role key for this job lives in GitHub Actions secrets only.

---

## Costs

Checked against Supabase's published pricing on 2026-09-24.

| Supabase free limit | need at 596 products |
|---|---|
| 1 GB storage | about 150 MB, growing with galleries at about 100 KB per photo |
| 500 MB database | a few MB |
| 5 GB egress a month | images are served through Vercel's optimiser and cached there; this mostly covers data sheet downloads, about 22,000 a month |
| 50,000 monthly users | a few staff |
| 2 active projects per account | one for Elaya |

Pro is $25 a month if the pausing or the limits start to bother anyone.

Two things outside Supabase to settle before launch:

- **Vercel**: the free Hobby plan is for non-commercial use, and this is a
  client's commercial site. Pro is about $20 a month. To confirm in C0.
- **Email for magic links**: Supabase's built-in sender is for testing, with a
  very low hourly limit, and may only send to members of the Supabase project
  team rather than to Elaya staff. Production needs a real sender: Elaya's own
  mail server, or a service with a free tier such as Resend. To confirm in C0.

---

## Moving to Elaya's account

Everything the database needs lives in the repo:

- `supabase/migrations/*.sql`: schema, row-level security, storage buckets and
  their policies, functions.
- `scripts/seed`, or a restore from the latest nightly backup.
- Environment variables only: project URL, anon key, site URL for magic-link
  redirects, the revalidation secret. The service key goes only into GitHub
  Actions.

The handover runbook (written in C11 and rehearsed once before launch):
create the project, link it, push the migrations, restore the latest backup,
set the auth redirect URLs and the email sender, set the Vercel environment
variables, redeploy, invite the staff.

---

## Stack and dependencies

The site runs on three runtime dependencies (`next`, `react`, `react-dom`).
The dashboard adds as few as it can, and everything except the Supabase
clients loads only under `/admin`. The public site reads the database on the
server only, so visitors download no more JavaScript than they do now.

**Staying as is:** Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5,
CSS Modules on the site's own tokens, Vitest, ESLint, the two audit scripts,
Playwright for the browser audit.

**New runtime dependencies**

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Database, storage and auth client |
| `@supabase/ssr` | Cookie-based sessions shared by server components, Server Actions and `proxy.ts` |
| `zod` | Validates Server Action input and every imported Excel row before it reaches the database |
| `radix-ui` | Dialogs, menus and toasts with correct focus handling. Admin only |
| `@dnd-kit/core`, `@dnd-kit/sortable` | Drag ordering for categories and galleries. Admin only |
| `exceljs` | Excel import and export, server side |

**New tooling:** the `supabase` CLI as a dev dependency (migrations, generated
TypeScript types, `supabase test db` for row-level security tests). Docker
Desktop only if C0 chooses a local Supabase over a cloud dev project.

**Services:** Supabase free tier; Vercel (plan to confirm in C0); GitHub
Actions for the nightly keep-alive and backup; an email sender for magic
links (Resend or Elaya's own mail server, to confirm in C0).

**No dependency needed**

- Downscaling photos before upload uses the browser's canvas. Safari cannot
  encode WebP from a canvas and silently returns PNG, so the uploader checks
  the output type and falls back to JPEG.
- Version diffs compare known fields directly.
- Drafts, preview and invalidation are Next built-ins: `draftMode`,
  `revalidatePath` or `cacheTag` with `updateTag`, and `proxy.ts`.

**Deliberately not used**

- An ORM such as Prisma or Drizzle. They connect with a database role that
  bypasses row-level security unless configured with care, which works against
  the rule that the app always acts as the signed-in user. supabase-js with
  generated types covers the need.
- A form library or a client data cache such as react-hook-form or React
  Query. Native forms with Server Actions and `useActionState` are enough.
- An image service such as Cloudinary. `next/image` already resizes.

---

## What stays out of scope

- The enquiries inbox. The contact form and shortlist still submit nowhere.
- Site copy, photography, FAQ and legal pages. They stay in code and the
  dictionaries.
- Prices, stock and anything shop-like.
- Per-finish variants beyond the photo and code columns reserved for them.
- Arabic product data.

---

## Milestones

Sizes are relative: S is a day or less, M a few days, L about a week.

- [ ] **C0 · Spike and confirm (S).** Enable `cacheComponents` on a branch and
      list what breaks on the public site; choose tags or paths. Confirm the
      Supabase built-in email restriction. Confirm the Vercel plan. Confirm
      local Supabase needs Docker on Windows, or use a cloud dev project
      instead. Record the outcomes here.
- [ ] **C1 · Async seam (S).** Make every `lib/catalogue.ts` function `async`,
      still reading the JSON, and update its eight call sites and the sitemap.
      Serve the search index from a route instead of a JSON import. The site
      must behave identically: every audit green, no visible change. Shippable
      on its own.
- [ ] **C2 · Supabase foundation (M).** Migrations for the schema, row-level
      security, buckets and policies. Environment wiring, `remotePatterns`,
      exclude `/admin` and `/api` from the locale rewrite. A test that proves
      an anonymous visitor cannot read drafts or write anything.
- [ ] **C3 · Seed and backups (M).** Full-catalogue ingest, the seed script,
      media upload, counts checked against the scrape. The nightly
      keep-alive and backup job.
- [ ] **C4 · Public site on the database (M).** `lib/catalogue.ts` reads the
      published read model. Caching and invalidation as chosen in C0.
      Redirects for changed slugs. Discontinued products hidden with their page
      kept. Parity check against the JSON, then remove the JSON read path.
- [ ] **C5 · Sign-in and the admin shell (S).** Magic link, the staff list,
      the `proxy.ts` gate plus a session check inside every Server Action (the
      proxy alone is not trusted), the `/admin` layout, `noindex`, the real
      email sender.
- [ ] **C6 · Product editor (L).** Fields, finishes from the library,
      completeness, version-checked saves with the conflict prompt, saving
      drafts.
- [ ] **C7 · Media (M).** Gallery upload with in-browser downscaling, reorder,
      captions and alt text, data sheets, orphan cleanup, a storage meter.
- [ ] **C8 · Publish, preview, history (M).** The publish action and
      invalidation, draft-mode preview, the History tab with diff and restore,
      the Activity feed.
- [ ] **C9 · Categories, finishes, ordering (M).** Category editing and drag
      ordering, the featured flag feeding the homepage, the finish library.
- [ ] **C10 · Import and export (M).** Excel export, import with the preview
      and error rows, imports landing as drafts.
- [ ] **C11 · Hardening and handover (M).** Row-level security tests in
      `npm run check`, the browser audit extended to `/admin` with a test
      session, the handover runbook, and one rehearsal of the move to a fresh
      Supabase account.
