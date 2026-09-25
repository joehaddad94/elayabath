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
| Sign-in | Direct sign-in by email while no email provider is configured; a magic link once one is | The dashboard is usable everywhere before the email provider conversation happens. The trade-off is spelled out under Access. |
| Arabic | Product data stays English only | Arabic, when it comes, covers site copy, which already lives in the dictionaries. |
| Prices | None | Quote-only stays the model. The `1 QAR` placeholders are not imported. |
| History | Every published version kept, with author and time, restorable | Several people with equal rights need an undo. |
| First user | Joe, on both the development account and Elaya's account | Set by the seed, not a migration. See Access. |
| Location | `/admin` on the same Next.js app | One deploy, shared types, and publishing can invalidate pages directly. |
| Images | An ordered gallery per product | The first image is the card image. |
| Discontinued | Hidden from grids, menus and search; the page stays with a notice and similar products | Old links and search rankings survive. |
| URL changes | Old URLs redirect permanently to new ones | Links in emails, PDFs and search results keep working. |
| Completeness | Warn, never block | The catalogue can go live with its gaps and improve over time. |
| Ordering | Manual order within a category, plus a featured flag for the homepage | |
| Phone | Desktop first, usable on a phone for viewing and small edits | Bulk import and gallery work expect a laptop. |
| Data grid | AG Grid Community (MIT), Infinite Row Model | Flexibility: inline editing, column control, saved views. The free edition covers everything the plan uses; no Enterprise licence is assumed (see Products grid). |
| Email | None sent, for now | Direct sign-in needs no email. Locally, anything Supabase does send lands in the mail catcher that ships with the local stack. No third-party provider until we decide on one together. |
| Import and export | Flexible | Any sheet layout through column mapping, several entities and formats, partial updates, templates, staged and reversible. See Import and export. |
| Scale | Designed for tens of thousands of products and many staff | Server-side paging, sorting, filtering and search everywhere, so growth never means a rewrite. See Scalability. |

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
  /admin  ── sign-in ─────────────▶ Auth
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
4. **New:** the Supabase service-role key does not reach the running app,
   with one narrow exception. The app uses the visitor's or the staff
   member's own session, so row-level security is what enforces access. The
   exception is direct sign-in (see Access), which needs the key to open a
   session without sending an email. It lives in a single server-only
   module, is used by that one Server Action, and only after the staff list
   has been checked. Otherwise the key exists only in the seed script and
   the nightly job.

### Drafts, publishing and history

The working tables are the drafts. Publishing a product:

1. writes an immutable snapshot of it into `revisions`, with author and time;
2. upserts it into the published read model the public site reads;
3. records a redirect if its slug changed;
4. invalidates the pages that show it: its own page, its category, the
   products index, the homepage if featured, the search index and the sitemap.

Every write goes through the same path, whatever screen it starts from: the
product editor, an inline edit in the grid, a bulk action or an import. Each
one is validated by the same schema, version-checked, and saved as a draft.
Nothing reaches the public site except through Publish.

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
staff             email, role (default 'editor'), invited_by, created_at
grid_views        id, owner, name, shared, column_state jsonb,
                  filter_model jsonb, sort_model jsonb
import_jobs       id, entity, file_path, mapping jsonb, options jsonb,
                  status, counts jsonb, created_by, created_at, applied_at
import_rows       job_id, row_number, raw jsonb, parsed jsonb,
                  outcome (new | changed | unchanged | error), diff jsonb,
                  errors text[]
mapping_presets   id, name, entity, mapping jsonb, created_by
```

- `family` is a check constraint mirroring `FinishFamily` in `src/lib/types.ts`,
  so the site and the database cannot disagree about what a family is.
- Material facets stay derived from finish families, as now.
- `staff.role` exists from day one, although everyone is an editor with
  equal rights. Roles can then be introduced later as policy, not migration.
- `status = draft` means never published. Only drafts can be deleted; anything
  that has been live is discontinued instead, so its URL keeps working.

### Access

**The `staff` table decides.** An email on it can use the dashboard; an email
that is not cannot, whichever way it tries to get in. Public sign-up is off.

Three layers check it, and any one of them stops a request on its own:

| Layer | Role |
|---|---|
| `proxy.ts` | Turns away anyone not signed in before an `/admin` page renders |
| Every Server Action | Checks the session and staff membership again before any change |
| Row-level security | Postgres checks `staff` on every read and write of working data. This is the layer that actually enforces access |

| who | can |
|---|---|
| anyone | read the published read model; read the three public buckets |
| a staff member, signed in | read and write working tables; publish; upload; add and remove staff |

**Signing in** depends on whether an email provider is configured, and
switches by itself when one is:

- **No provider (now): direct sign-in.** Enter an email. If it is on the list,
  a session opens immediately. No email, no password, no code. Under the hood
  the server asks Supabase for a sign-in token without sending it, and
  redeems it on the spot, which is the one use of the service key in the app.
- **Provider configured: a magic link** to the same address, as originally
  planned. Nothing else changes.

**The trade-off of direct sign-in.** The email address is the only credential,
so anyone who knows a listed address can sign in as that person. Two guards
come with it:

- The list refuses any address published on the site. `Info@`, `Design@` and
  `Salessupport@elayabath.com` all appear on the Contact page, and a shared
  mailbox on the list would let anyone who read that page in.
- Every direct sign-in is recorded, with the time and the address, and shown
  in the Activity feed, so a sign-in nobody recognises is visible.

Moving to magic links, once a provider is chosen, removes the trade-off.

**The first user** is created by the seed, never by a migration. A migration
runs identically on every database it is applied to, so an email in one would
be baked into Elaya's production schema history for good. The seed reads the
address from a setting, `BOOTSTRAP_STAFF_EMAIL`, and adds that single row. It
is Joe on the development account and, as decided, Joe on Elaya's account at
handover too. The address is kept in configuration, not written into the repo.

**Adding staff** is adding a row to `staff`, which any staff member can do.
A sign-up hook (a database function Supabase runs before creating any
account) rejects every address not on the list, so invitations need neither
email nor the service key.

**Removing staff** is deleting the row. Row-level security reads the list on
every query, so access to data ends on the next request, even if the removed
person's session has not expired. The database refuses to remove the last
remaining staff member, so the team cannot lock itself out.

---|---|
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

- **Products**: the grid, described below.
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

### Products grid

Built on **AG Grid Community**, using the **Infinite Row Model**: the grid asks
the server for one block of rows at a time as the user scrolls, passing its
sort and filter state, and the server answers from an indexed Postgres query.
The same grid therefore behaves identically at 596 products or 60,000.

- **Columns**: item code, image, name, category, type, status, finishes
  count, completeness, featured, last edited by and when. Resizable,
  reorderable and pinnable.
- **Filtering and search**: per-column filters, plus one search box across
  name and code that uses the database's trigram index.
- **Inline editing** for simple fields (name, type, status, dimensions,
  featured). An edit is validated, version-checked and saved as a draft,
  exactly as in the editor. Fields with structure (gallery, finishes,
  description) open the product editor instead.
- **Bulk actions** (publish, hide, set category, set featured) apply either to
  the ticked rows or to **everything matching the current filter**. The second
  is sent to the server as the filter itself, not a list of ids, because the
  Infinite Row Model cannot select rows it has not loaded, and because a list
  of 20,000 ids is the wrong thing to send anyway.
- **Saved views**: a named combination of columns, filters and sort, private
  or shared with the team, e.g. "Washbasins needing dimensions". Stored in
  `grid_views`, and also mirrored in the URL so a view can be sent as a link.
- **Theme**: AG Grid's theming API mapped onto the site's tokens, so the grid
  follows Ink and Stone like everything else. It renders real DOM, so the
  browser audit can measure its contrast and target sizes.

**Enterprise features the plan does not use**, and what stands in for each:

| Enterprise feature | Instead |
|---|---|
| Excel export | `exceljs` on the server, which also gives full control over the file |
| Server-Side Row Model | Infinite Row Model with server-side sort and filter |
| Tool panels (column chooser) | Our own menu driving the grid's column API |
| Clipboard and range selection | Not needed; bulk edits go through import |
| Row grouping, pivoting, master/detail | Not needed |

If one of these becomes worth paying for, the grid is already AG Grid, so it
is a licence key rather than a rewrite.

### Completeness score

Image, product type, dimensions, description, data sheet, at least one
finish: six checks, shown as a score and as the list of what is missing. It
never blocks publishing.

---

## Import and export

Designed to take whatever shape of spreadsheet Elaya already has, rather than
insisting on ours.

**What can be imported or exported**: products, categories, finishes, and the
product-to-finish links. Each is its own entity with its own columns.

**Formats**: `.xlsx`, `.csv` and `.tsv` in; `.xlsx` and `.csv` out.

**Import**

1. **Upload** to a private `imports` bucket. An `import_jobs` row records who,
   what, and when.
2. **Map columns.** Headers are matched to fields automatically where the
   names agree, and anything unmatched is mapped by hand or ignored. A mapping
   can be saved as a preset, so a recurring sheet maps itself next time.
3. **Choose the rules**: which column identifies a row (item code by default,
   or the internal id when codes themselves are being changed); whether a
   blank cell means "leave unchanged" (the default) or "clear this field";
   whether unknown rows are created or skipped.
4. **Stage.** The file is processed in chunks into `import_rows`, each row
   parsed, validated by the same schema the editor uses, and compared with the
   database: new, changed field by field, unchanged, or an error with the
   reason. Chunking keeps every request inside the hosting platform's time
   limit, whatever the file size, and progress is shown as it runs.
5. **Preview** in the same AG Grid, filterable by outcome, so a 5,000-row
   import with 12 errors can be reviewed by looking at the 12.
6. **Apply.** Only mapped columns are touched: a sheet of item codes and
   dimensions changes dimensions and nothing else. Changes land as drafts,
   tagged with the job, applied in batches, each batch in a transaction.
7. **Publish or discard as a unit.** "Publish everything from this import" and
   "discard this import's drafts" both act on the job, so a bad import is one
   click to undo before it ever goes live.

**Export**

- The current grid view (its filters, sort and visible columns), the ticked
  rows, or the whole entity; working copy or published.
- Column choice and order, saved with the view.
- Written as a stream on the server, so a large catalogue never has to fit in
  memory, and delivered as a download.
- **Round-trip safe**: an export can be edited and imported back unchanged,
  and a blank template can be downloaded for any entity.

Images are not carried in spreadsheets. An image URL column can be added
later if it is ever needed; it is left out now because fetching arbitrary
URLs from a server needs its own safeguards.

## Scalability

The catalogue is 596 products today. Everything is built so that ten times or
a hundred times that changes configuration or plan tier, not code.

- **No screen loads a whole table.** The grid pages from the server; imports
  and exports stream in chunks; bulk actions run as server-side queries.
- **Indexes from the first migration**: item code, slug, status, category,
  position, last edited; a trigram index on name and code for search.
- **Public search moves to the database.** Today every visitor who opens
  search downloads the whole index, about 45 KB at 596 products and far too
  much at tens of thousands. It becomes a server-side query with results
  cached per term.
- **Category shelves move to the database.** Filtering, facet counts and
  sorting are pure functions in `lib/product-filters.ts` today, run in the
  browser over every product in the category. They are reimplemented in SQL
  with the same meaning, and the existing tests become the specification both
  versions must pass. Shelves then page like the grid does.
- **Prerendering is bounded.** Building every product page at deploy time
  gets slower as the catalogue grows. Only the featured and most-visited pages
  are built ahead; the rest render on first request and are cached, which the
  plan already relies on for new products.
- **The sitemap splits** into an index of sitemaps once it nears the 50,000
  URL limit, which Next supports directly.
- **Storage stores paths, not URLs.** The host comes from configuration, so a
  move to a larger plan or another store is a copy and a setting.
- **Invalidation is batched.** A bulk publish of 500 products refreshes each
  list page once, not 500 times.
- **Roles are ready**, through `staff.role`, when the team outgrows equal
  rights.

## Seeding

1. Re-run the ingest with the slice quotas removed, so it covers all 596
   products, and with the per-finish photos kept.
2. A one-off `scripts/seed` loads the result into Supabase and uploads the
   media. Measured: about 8 MB of product images, about 134 MB of data
   sheets, about 1 MB of swatches and room photography. The scrape itself is
   735 MB, but that is WordPress's many resized copies of each photo; only one
   optimised image per product is kept.
3. Everything in the six mapped categories is imported as published, since it
   is already live on the old site. Placeholder prices are dropped.
3a. **The other 56 products** sit in old-site categories this site does not
   map: shower toilets (15), urinals (15), kitchen mixers (12), bidets (11)
   and accessible fittings (3). Decided 2026-09-24: they are seeded into five
   new categories, Shower Toilets, Urinals, Kitchen, Bidets and Accessible,
   **as drafts**, products included, for staff to publish when they choose.
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
- **Email**: deferred by decision. See Email below.

---

## Email

Nothing is sent until we choose a provider together. Sign-in is direct while
there is none (see Access), and adding staff is a row in a table, so neither
needs email today.

- Anything Supabase does send in development is delivered to the **mail
  catcher bundled with the local stack**, a web inbox on the developer's
  machine. Nothing leaves it.
- There is **one switch** for later: Supabase Auth's SMTP settings. Any email
  the app itself sends in future goes through a single `lib/email` module with
  one interface, so changing provider touches configuration and one file.
- **When a provider is chosen**, sign-in switches to magic links on its own
  and the direct sign-in trade-off goes away. Until then the dashboard works
  everywhere, deployed or local.

## Moving to Elaya's account

Everything the database needs lives in the repo:

- `supabase/migrations/*.sql`: schema, row-level security, storage buckets and
  their policies, functions.
- `scripts/seed`, or a restore from the latest nightly backup.
- Environment variables only: project URL, anon key, site URL for magic-link
  redirects, the revalidation secret. The service key goes only into GitHub
  Actions.

The handover runbook (written in C11 and rehearsed once before launch):
create the project, link it, push the migrations, run the seed with
`BOOTSTRAP_STAFF_EMAIL` set to Joe's address, restore the latest backup,
set the auth redirect URLs and the email provider (once one is chosen), set
the Vercel environment variables, redeploy, invite the staff.

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
| `ag-grid-community`, `ag-grid-react` | The products grid and the import preview. Community edition, MIT. Only the modules used are registered, to keep the bundle down. Admin only |
| `exceljs` | Excel reading and streamed writing, server side |

**New tooling:** the `supabase` CLI as a dev dependency: the local stack
(Postgres, Auth, Storage and the mail catcher), migrations, generated
TypeScript types, and `supabase test db` for row-level security tests. It
runs on Docker Desktop, which is already installed on the development
machine (28.0.4 on WSL2) and only needs starting.

**Services:** Supabase free tier; Vercel (plan to confirm in C0); GitHub
Actions for the nightly keep-alive and backup. No email provider yet: see
Email.

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

- [x] **C0 · Spike and confirm (S).** Enable `cacheComponents` on a branch and
      list what breaks on the public site; choose tags or paths. Theme AG Grid
      from the site's tokens in both palettes and confirm the browser audit can
      read it. Confirm that cell editing and CSV export are in the Community
      edition. On the local stack, confirm that a sign-in token can be
      issued and redeemed without sending an email, and that the sign-up
      hook rejects unlisted addresses. Confirm the Vercel plan. Record the
      outcomes here.
- [x] **C1 · Async seam (S).** Make every `lib/catalogue.ts` function `async`,
      still reading the JSON, and update its eight call sites and the sitemap.
      Serve the search index from a route instead of a JSON import. The site
      must behave identically: every audit green, no visible change. Shippable
      on its own.
- [x] **C2 · Supabase foundation (M).** The local stack through the CLI,
      including the mail catcher. Migrations for the schema, indexes,
      row-level security, buckets and policies. Environment wiring,
      `remotePatterns`, exclude `/admin` and `/api` from the locale rewrite. A
      test that proves an anonymous visitor cannot read drafts or write
      anything.
- [x] **C3 · Seed and backups (M).** Full-catalogue ingest, the seed script,
      media upload, counts checked against the scrape. The nightly keep-alive
      and backup job.
- [x] **C4 · Public site on the database (L).** `lib/catalogue.ts` reads the
      published read model. Caching and invalidation as chosen in C0.
      Redirects for changed slugs. Discontinued products hidden with their
      page kept. Search as a server query. Category filtering, facets and sort
      in SQL, passing the existing tests. Bounded prerendering. Parity check
      against the JSON, then remove the JSON read path.
- [x] **C5 · Sign-in and the admin shell (M).** Direct sign-in while no
      provider is configured, magic links once one is, switching on its own.
      The staff list with its role column, the bootstrap row from
      `BOOTSTRAP_STAFF_EMAIL`, the sign-up hook, the last-staff guard, the
      refusal of addresses published on the site, and a record of every direct
      sign-in. The `proxy.ts` gate plus a session check inside every Server
      Action (the proxy alone is not trusted), the `/admin` layout, `noindex`.
- [x] **C6 · Products grid (M).** AG Grid on the Infinite Row Model over a
      paged, sorted, filtered server query. Search, column chooser, saved and
      shared views, bulk actions by selection or by filter, inline editing of
      simple fields through the draft path.
- [x] **C7 · Product editor (L).** Fields, finishes from the library,
      completeness, version-checked saves with the conflict prompt, saving
      drafts.
- [x] **C8 · Media (M).** Gallery upload with in-browser downscaling, reorder,
      captions and alt text, data sheets, orphan cleanup, a storage meter.
- [ ] **C9 · Publish, preview, history (M).** The publish action and batched
      invalidation, draft-mode preview, the History tab with diff and restore,
      the Activity feed.
- [ ] **C10 · Categories, finishes, ordering (M).** Category editing and drag
      ordering, the featured flag feeding the homepage, the finish library.
- [ ] **C11 · Import and export (L).** Upload, column mapping and presets,
      import rules, chunked staging with progress, preview in the grid, apply
      in batches, publish or discard by job; streamed export of views,
      selections or whole entities; templates; a round-trip test.
- [ ] **C12 · Hardening and handover (M).** Row-level security tests in
      `npm run check`, the browser audit extended to `/admin` with a test
      session, load tests of the grid and of import at ten times the
      catalogue, the handover runbook, and one rehearsal of the move to a
      fresh Supabase account.

### C0 outcomes

- **Caching: tags.** `cacheComponents: true` builds the current site with no
  code changes: every real page stays fully static, and only the shells of
  dynamic routes become partial prerenders. The browser audit passes
  unchanged (38 page loads, no problems). The flag is switched on in C4,
  where the first cached reads appear.
- **Direct sign-in works with nothing sent.** Against the local Auth
  service: the server issues a sign-in token without sending anything and
  redeems it on the spot. A first sign-in gets a `signup` token, a returning
  one a `magiclink` token, so the action redeems with the type Auth reports
  (`verification_type`) rather than assuming. The session is recognised as
  staff and sees drafts; an anonymous client sees none. Emails sent: 0.
- **The sign-up hook refuses unlisted addresses** through the real Auth API,
  with a 403 and "This address is not on the staff list."
- **Local Supabase runs on Docker Desktop** (28.0.4, WSL2), without the
  services the dashboard does not use: realtime, edge functions, analytics.
- **Still open:** the Vercel plan (Joe to confirm). The AG Grid checks move to
  C6, where the grid is built.

### C3 outcomes

- **Staged and seeded: 596 products, 11 categories, 87 finishes** (the old
  site's exact finish count), 3,719 product-finish links, 596 photographs.
  540 products are live in the six published categories; 56 sit in the five
  draft categories. Every count is checked against what was staged.
- **34 gaps, recorded not fatal:** 20 products never had a data sheet linked,
  9 sheets could not be fetched, 5 photographs are too small to use well. No
  product is missing a photograph. They are in `.seed/data/gaps.json` and
  become the Needs attention list.
- **Per-finish photographs: 6 genuine.** The old site pointed 18 variations
  at photos of their own, but 12 were artefacts (the parent photo, a paired
  product's code, in one case a different product entirely). Only photos
  whose own name carries the finish's code are taken.
- **Finish codes are not unique in the client's data.** P08 is two different
  finishes, Polished Copper (67 products) and Polished Rose Gold (9), so a
  quote for "P08" cannot tell them apart; RT10 and RT13 are each one finish
  entered twice. Nothing is merged: the slug is the identity, the code is
  indexed, and `duplicate_finish_codes` lets the dashboard flag each one.
  **P08 needs a decision from Elaya.**
- The seed refuses a database that already has products, so it can never
  overwrite staff edits on a hosted project.
- **Backups:** `scripts/backup` exports all 19 tables (3.5 MB) plus a
  540-product `catalogue.json`, verified locally. Three limits: GitHub runs
  scheduled workflows only from the default branch, so the job starts once
  this is on `main`; GitHub switches schedules off in a repository with no
  activity for 60 days, after which it needs re-enabling with one click; and
  files in Storage are not in the backup, so dashboard uploads exist only in
  Storage until a paid plan or a separate media backup covers them.

### C4 outcomes

- **Parity: 50 of 50 products identical on all 13 fields** checked against
  the JSON the site was built from, and all 50 pages render from the
  database.
- **Search and shelves run in SQL.** `public.search_catalogue` and
  `public.shelf` carry the old rules, and the browser-side tests were ported
  case for case (`supabase/tests/search.test.sql`, `shelf.test.sql`); the
  TypeScript implementations were removed rather than kept as dead code. 47
  database tests in all.
- **Verified in the browser:** a shelf pages 24 at a time ("Show 24 more"),
  filters and sorts through `/api/shelf`, and a shared filtered link loads
  filtered. A renamed product's old URL answers 308 to the new one. A
  discontinued product keeps its page with a notice and leaves search and
  the shelf.
- **Only featured pages are built ahead.** Everything else renders on first
  visit and is cached until a publish clears it.
- **The full catalogue found a real accessibility gap:** a product called ACE
  has a title link narrower than 24px, so card titles now have a minimum
  width as well as height.
- **Known quirk:** the first, uncached render of a redirect sends its
  `Location` header twice, both with the same value; every later response
  sends one. That is Next's behaviour, and browsers and crawlers follow it
  correctly. Avoiding it would mean a database lookup in the proxy on every
  product request.
- **To confirm in C9:** the sitemap is built ahead, so it only drops a
  discontinued product once publishing clears its cache tag.

### C5 outcomes

- **Seventeen behaviours verified end to end** in a real browser against the
  local stack: signed-out requests go to sign-in and come back afterwards;
  an unlisted address and a published one are refused with the same
  wording, so the form reveals nothing; the first staff member signs
  straight in; the staff list refuses a published address; a colleague can
  be added, signs in, and on being removed is turned away on their next
  page with the reason; the last member cannot be removed; sign-ins and
  refusals are recorded and shown on the Staff page; signing out works; and
  an eleventh attempt from one connection within fifteen minutes is
  refused, even for a real address.
- **Every dashboard response is `noindex` and `no-store`**, set by the proxy;
  `robots.txt` also disallows `/admin` and `/api/`.
- **The service key's use is exactly two files:** the sign-in action and the
  magic-link confirmation route, both before a user exists to act as.
- **Session reads render inside `<Suspense>`.** Under `cacheComponents`,
  reading cookies is request data; the dashboard's frame is static and the
  signed-in part streams in.
- **The database tests now start from a clean slate** inside their own
  transaction, so they pass whether or not the local database holds the
  seeded catalogue, and the rollback leaves it as it was.

### C6 outcomes

- **Twenty-one checks pass in a real browser** against the seeded catalogue:
  the grid opens on 596 products and pages in 100-row blocks as it scrolls;
  search, category, "needs attention" (285) and "unpublished changes" (56)
  narrow it; column filters and sorts run in the database, and an unknown
  column name is ignored rather than reaching the query; the rows route
  refuses anyone signed out.
- **Inline edits go through the draft path.** A rename saves to the working
  copy with the version bumped while the live page is unchanged; a stale
  edit is refused with the name of whoever saved first; publishing puts the
  change on the public page on the next request.
- **Bulk actions work on ticked rows or on everything matching**, and say
  that the result is a draft. Publishing everything matching asks first.
- **Saved views** round-trip through a link (`?view=`), and the grid's
  colours follow both palettes.
- **Two bugs found and fixed in testing:** narrowing the filters while
  scrolled far down asked for rows past the end, which the database refuses;
  the route now answers with no rows and the new count, and a reload scrolls
  to the top. A block requested before a reload could also land after it and
  overwrite the count; stale answers are now ignored.
- **AG Grid modules are registered one by one** (Community only). The grid
  names any it is missing in the console, which is how two were caught; the
  C12 admin audit keeps watching for that.

### C7 outcomes

- **Twenty-seven checks pass in a real browser.** The item code in the grid
  opens the editor. A save writes every field and the finish list as one
  new version, through `public.save_product`, while the live page stays as
  it was. Ctrl+S saves. Leaving with unsaved changes asks first.
- **Conflicts offer the choice the plan promised.** A stale save is refused
  and names who saved first; "Keep mine and overwrite" replaces the version
  that was shown, never a blind write; "Load their version" swaps the form
  for theirs.
- **Publishing from the editor** saves first if needed, then publishes, and
  the public page changes on the next request. A new web address leaves a
  308 from the old one, and the editor says so before publishing. An
  address that still redirects to another product can't be taken, since
  publishing would steal that redirect. A discontinued product keeps its
  page, marked.
- **New products** start as drafts from an item code, a name and a category,
  with the address derived from the code as the seed does. Only a product
  that has never been published can be deleted; anything that has been live
  is discontinued instead. Both rules are enforced in the database.
- **One schema for every write:** `src/lib/admin/product-schema.ts` is used by
  the editor as you type, by its Server Action, and by the grid's inline
  edits, and will be used by import. Checked against all 596 seeded
  products, which found item codes like "E06-SW10353 A+ E06-SW10353 B" that
  name a pair; codes may contain `+`.
- **A finish keeps its own photo** when the list is reordered or edited; only
  its position moves. Codes shared by two finishes (P08, RT10, RT13) are
  marked in the picker.
- **Found in testing:** publishing refreshes the page, and the editor was
  keyed on the version number, so it rebuilt itself and lost its message.
  It now keeps what is on screen and takes the server's copy only when
  asked or when nothing here is unsaved. Also, after a refused New product
  form, React cleared the category choice; the form is now rebuilt with
  what was typed.
- **Tests:** 12 more database tests (`supabase/tests/save.test.sql`, 59 in
  all) and 8 unit tests for the schema (77 in all).

### C8 outcomes

- **Twenty checks pass in a real browser** with phone-sized photos (4000 x
  3000). Photos are reduced in the browser to 1600px on the long edge and
  sent straight to Storage as WebP (JPEG where the browser can't write
  WebP): a 369 KB test photo arrived as 31 KB, and a 5 MB phone photo will
  typically arrive as a few hundred KB. A file that isn't a photo is refused
  by name. iPhone HEIC photos that the browser can't read get a message
  asking for JPEG or PNG.
- **The gallery and data sheet are part of the draft.** Uploading puts the
  file in Storage, and the product changes only when saved, through the
  same version-checked `save_product` as every other field. So there is one
  Save, one conflict check and one Publish for everything. Order, "make
  main", alt text (prefilled from the name and dimensions, flagged when
  empty) and captions all save together. The grid's thumbnail follows the
  main photo, and on publish the live page leads with it and links the new
  data sheet.
- **Every upload gets a new name** inside `products/<product id>/`. Files are
  cached for a year, so a replaced photo is never the old address
  overwritten. The id, not the web address, names the folder, so it
  survives renames. A save can only claim files the product already has or
  files from its own folder.
- **Unused means unused everywhere.** `public.media_in_use()` counts the
  working copy, the live site and every published version in the history,
  so restoring an old version (C9) always has its photos. Only uploads
  that were never saved, or were replaced before being published, are
  unused, and only after a day's grace. The Media page lists them and
  removes them on request; nothing is deleted automatically. Today every
  stored file is in use.
- **The storage meter** is on the Media page and the overview: 121 MB of the
  free plan's 1 GB, 115 MB of it data sheets. It warns above 80%.
- **Found in testing:** the cleanup's confirmation disappeared because the
  refreshed page swapped the section it lived in; it is now kept in place.
- **For the runbook:** a publish from a script with the service key updates
  the database but not the site's cached pages, which are only refreshed by
  publishing from the dashboard. Anything run outside the dashboard should
  be followed by a redeploy.
- **Tests:** 65 database tests (gallery and data sheet saves, storage guards)
  and 79 unit tests.

Choosing an email provider is deliberately not a milestone. It is a
conversation to have before the dashboard is used anywhere but the development
machine, and the switch is configuration when it happens.
