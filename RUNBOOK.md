# Elaya Bath: runbook

How the site and its dashboard are run, set up, moved and looked after. The
design and the reasons behind it are in [CMS-PLAN.md](./CMS-PLAN.md); this file
is the list of things to do.

## What runs where

| Part | Where | What it holds |
|---|---|---|
| The site and the dashboard (`/admin`) | Vercel, one Next.js app | Nothing of its own: pages are built from the database and cached |
| Database, sign-in, files | Supabase: Postgres, Auth, Storage | The catalogue (working copy, live copy, history), staff list, photos, data sheets |
| Nightly backup | GitHub Actions, `.github/workflows/catalogue-backup.yml` | Every table as JSON on the `catalogue-backup` branch |

Nothing reaches the public site except through Publish. Everything staff edit
is a draft until then.

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, `.env.local` | The project URL. Public by design |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel, `.env.local` | Public by design; row-level security does the protecting |
| `SUPABASE_SECRET_KEY` | Vercel (marked sensitive), `.env.local`, GitHub secret | Bypasses row-level security. Server only. Never in a `NEXT_PUBLIC_` variable, never in chat or a commit |
| `BOOTSTRAP_STAFF_EMAIL` | `.env.local` or the env file used for seeding | The first staff member, added by the seed. Not needed on Vercel |
| `ADMIN_SIGN_IN` | Vercel | Leave unset until an email provider is set up (see below) |

`.env.local` is gitignored. `.env.example` lists the same names.

## Local development

Needs Node 20 or newer and Docker Desktop.

```bash
npm install
npm run db:start                  # local Supabase, without the parts the site doesn't use
npx supabase status -o env        # prints the URL and keys for .env.local
npm run seed                      # the catalogue, from the staged scrape in .seed/
npm run dev                       # http://localhost:3000, dashboard at /admin
```

The seed reads `.seed/`, which is gitignored. If it is missing, stage it from
the source archive first: `INGEST_OUT=.seed INGEST_SLICE=all npm run ingest`.

The seed refuses a database that already has products. To start again:
`npm run db:reset`, then `npm run seed`.

### Checks

| Command | What it proves | Needs |
|---|---|---|
| `npm run check` | Types, lint, 88 unit tests, the static audit, 134 database tests (access rules included), the production build. The gate before every push | The local stack running |
| `npm run audit:browser` | The public site in a real browser: contrast, overflow, headings, targets, images, metadata | A running server (`npm run build && npm start`) and Playwright |
| `npm run audit:admin` | The same checks on every dashboard screen, signed in | As above, plus `.env.local` |
| `npm run load` | Import of 6,000 products and the grid's heaviest queries at ten times the catalogue. Local only, cleans up after itself | As above |

Playwright is installed on demand, not as a dependency:
`npm i --no-save playwright && npx playwright install chromium`. Other
`npm install` runs remove it again.

## Setting up a hosted project

For the first hosted project, and again for Elaya's own account. Steps that
need a login or a secret are for Joe (or Elaya) to run, not to paste anywhere.

1. **Create the project** in the Supabase dashboard. The current one is in
   Frankfurt (`eu-central-1`), and `vercel.json` runs the site's server code
   in Frankfurt (`fra1`) to match: every dashboard action and page rebuild
   queries the database, so the two must be neighbours. A project in another
   region needs `vercel.json` changed to match. Note the project ref, the
   URL, the publishable key and the secret key.
2. **Link the repository** to it:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   ```
3. **Create everything** (tables, functions, access rules, storage buckets and
   their rules): `npx supabase db push`. Every migration in
   `supabase/migrations/` is applied in order. This was rehearsed from an
   empty database on 25 September 2026: all 15 migrations applied cleanly.
4. **Set up sign-in** in the Supabase dashboard, under Authentication:
   - URL configuration: Site URL `https://<the site's domain>`, and add
     `https://<the site's domain>/admin/auth/confirm` to the redirect URLs.
   - Hooks: turn on "Before user created" as a Postgres function,
     `public.hook_before_user_created`. This is what refuses anyone not on
     the staff list. **Without it, anyone could create an account.** (They
     would still see nothing, since every rule checks the staff list, but
     the hook keeps the account list clean.)
   - Leave email sign-ups on: the hook limits them to the staff list, and
     direct sign-in needs them.
5. **Fill it**, one of:
   - A new catalogue: put the project's URL, secret key and
     `BOOTSTRAP_STAFF_EMAIL` in a file such as `.env.hosted` (gitignored:
     keep it out of the repository), then
     `node --env-file=.env.hosted scripts/seed/index.ts`.
   - Moving an existing catalogue: see the next section.
6. **Point Vercel at it**: set the variables above for Production (and
   Preview if previews should work), then redeploy. Deploy after the data is
   in: the build reads the database to prebuild the homepage and featured
   products.
7. **Turn on the nightly backup**: in the GitHub repository settings, add the
   secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then run "Catalogue
   backup" once by hand from the Actions tab. Scheduled runs only happen from
   the default branch (`main`).
8. **Check it**: sign in at `/admin`, publish a small change to one product,
   open its page, then `BASE=https://<domain> npm run audit:browser`.

## Moving to Elaya's account

Everything moves: every table (working copy, live copy, full history,
redirects, staff list, saved views, import history) and every stored file.
Rehearsed locally on 25 September 2026: after an export, a reset and an
import, a second export was identical table for table, all 1,247 files were
byte for byte the same, and every browser check and both audits passed.

1. **Ask staff to stop editing** until the move is done. It takes minutes.
2. **Export** from the current project. Put its URL and secret key in
   `.env.source`, then:
   ```bash
   node --env-file=.env.source scripts/move/export.ts ../elaya-move
   ```
   The folder is about 120 MB, mostly data sheets. Keep it outside the
   repository.
3. **Set up the new project**: steps 1 to 4 of the section above, on Elaya's
   account.
4. **Import** into it. Put the new project's URL and secret key in
   `.env.target`, then:
   ```bash
   node --env-file=.env.target scripts/move/import.ts ../elaya-move
   ```
   It refuses a project that already has products, and ends by checking
   every count against the export. The new site builds its pages from the
   database when it deploys in the next step, so no cache refresh is needed.
5. **Switch Vercel** to the new project's three variables and redeploy.
6. **Switch the backup** to the new project's secrets in GitHub.
7. **Staff sign in again.** Sign-in accounts are not moved; the staff list is,
   so each person's first sign-in creates their account.
8. Keep the old project for a week, untouched, then delete it.

Delete `.env.source`, `.env.target` and the export folder when done; they hold
a secret key and a full copy of the catalogue.

## Sign-in and staff

- **Now, without an email provider**: anyone on the staff list signs in by
  entering their address. Nothing is emailed.
- **Once an email provider is chosen**: set it up under Authentication, SMTP
  settings, set `ADMIN_SIGN_IN=link` on Vercel and redeploy. Sign-in then sends
  a link, and direct sign-in stops. Which provider is a decision still to
  make.
- Staff are added and removed on the Staff page. The last staff member can't
  be removed, and addresses published on the site (such as the contact
  address) can't be staff sign-ins.
- After 10 refused attempts from one connection within 15 minutes, that
  connection can't sign in for the rest of the 15 minutes, even with a real
  address.

## Publishing and the site's cache

Pages are built once and kept until something they show is published; then
only those pages are rebuilt, on their next visit. Publishing from the
dashboard does this automatically.

**Anything that changes the database outside the dashboard does not**: the
seed, `move:import`, a script using the secret key, or SQL run by hand. After
any of those, refresh every cached page from the database:

```bash
curl -X POST https://<the site's domain>/api/admin/revalidate -H "Authorization: Bearer <secret key>"
```

It answers with how many pages it refreshed. A signed-in staff member can
call it too. Redeploying on Vercel does the same, more slowly.

## Backups

- **Tables**: every night at 05:17 Doha time, to the `catalogue-backup` branch.
  A night with no edits makes no commit. GitHub turns scheduled workflows off
  in a repository with no activity for 60 days; if the Actions tab says so,
  turn it back on with one click.
- **Files are not in the nightly backup.** Once a month, and before any risky
  change, take a full copy with `scripts/move/export.ts` (as in "Moving",
  step 2) and keep the folder somewhere safe. It is the same folder a move
  uses, so it can be imported into a fresh project if the old one is lost.

## Limits on the free plan

| Limit | Where it shows | What to do |
|---|---|---|
| 1 GB of files | The storage meter on Media and the overview; it warns above 80% | Remove unused files on the Media page, or move to a paid plan |
| 500 MB of database | Supabase dashboard | Far away: the catalogue and its history are a few MB |
| The project pauses after a week without activity | Everything stops answering | The nightly backup is the activity that prevents it; keep it running |
| No point-in-time restore | | The nightly backup and the monthly full copy |

## When something goes wrong

| What you see | What it means |
|---|---|
| "That address can't sign in to the dashboard." | It isn't on the staff list, or it is an address published on the site. The message is the same for both on purpose |
| Sent back to the sign-in page mid-session | The person was taken off the staff list |
| "Someone saved this product while you were editing it" | Two people edited at once. Choose "Load their version" or "Keep mine and overwrite" |
| A page shows old content after a script or SQL | The cache: call `/api/admin/revalidate` (see above) |
| "Rows couldn't be loaded" in the grid | The connection to Supabase dropped. Reload; if it persists, check the project isn't paused |
| An import row says it was "left alone" | Someone changed that row after the import was checked. Check the file again to include it |
| An import says a code "belongs to" two finishes | The client's data has codes shared by two finishes (P08, RT10, RT13). Use the finish's web address instead of its code |
| Uploads fail | Check the storage meter; the free plan holds 1 GB |

## Scripts

| Script | Use |
|---|---|
| `scripts/seed/` | Fills an empty project from the staged scrape |
| `scripts/backup/` | The nightly table backup (run by GitHub Actions) |
| `scripts/move/export.ts`, `import.ts` | A full copy of a project, and loading it into another |
| `scripts/audit/` | The static, public and dashboard audits |
| `scripts/load/` | The load test |
| `scripts/ingest/` | Turns the source archive into staged data for the seed |
