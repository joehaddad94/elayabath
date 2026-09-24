-- Catalogue schema: the working tables staff edit, the read model the public
-- site reads, and the tables around them (history, redirects, staff, views,
-- imports).
--
-- Everything here is reproducible from the repo. Nothing is configured by
-- hand in the Supabase console, so moving to Elaya's own account is a replay.

create extension if not exists pg_trgm with schema extensions;

-- ── types ──────────────────────────────────────────────────────────────────

-- draft: never published. active: live. discontinued: hidden from grids,
-- menus and search, but its page keeps working so old links survive.
create type public.entity_status as enum ('draft', 'active', 'discontinued');

create type public.finish_status as enum ('active', 'retired');

-- Mirrors FinishFamily in src/lib/types.ts, so the site and the database
-- cannot disagree about what a family is.
create domain public.finish_family as text
  check (value in (
    'ceramic', 'solid-surface', 'resin', 'marble', 'concrete', 'acrylic', 'plating'
  ));

-- ── shared triggers ────────────────────────────────────────────────────────

-- Every save bumps the version and stamps who and when. Doing it here rather
-- than in application code means no write path can forget, including
-- imports and anything written later.
create function public.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Publishing records `published_version = version`. That is bookkeeping,
  -- not an edit: bumping the version here would make a row look unpublished
  -- the instant it was published.
  if new.published_version is distinct from old.published_version then
    return new;
  end if;
  new.version    := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end;
$$;

-- ── staff ──────────────────────────────────────────────────────────────────

create table public.staff (
  email       text primary key check (email = lower(email)),
  -- Everyone is an editor with equal rights today. The column exists so that
  -- roles can arrive later as policy rather than as a migration of data.
  role        text not null default 'editor',
  invited_by  text,
  created_at  timestamptz not null default now()
);

-- Addresses the public site publishes. Under direct sign-in the email is the
-- only credential, so a published shared mailbox on the staff list would let
-- anyone who read the Contact page in. The seed fills this from the site's
-- own dictionary, which stays the single source of truth.
create table public.reserved_addresses (
  email text primary key check (email = lower(email))
);

create function public.guard_staff_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  if exists (select 1 from public.reserved_addresses r where r.email = new.email) then
    raise exception 'The address % is published on the site and cannot be a staff sign-in.', new.email
      using errcode = 'check_violation';
  end if;
  new.invited_by := coalesce(new.invited_by, auth.jwt() ->> 'email');
  return new;
end;
$$;

create trigger staff_guard_insert before insert on public.staff
  for each row execute function public.guard_staff_insert();

-- The team must never be able to lock itself out.
create function public.guard_last_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.staff) <= 1 then
    raise exception 'The last staff member cannot be removed.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger staff_guard_last before delete on public.staff
  for each row execute function public.guard_last_staff();

-- Every direct sign-in, so a sign-in nobody recognises is visible.
create table public.sign_in_log (
  id          bigint generated always as identity primary key,
  email       text not null,
  method      text not null check (method in ('direct', 'link')),
  ip          text,
  user_agent  text,
  at          timestamptz not null default now()
);
create index sign_in_log_at on public.sign_in_log (at desc);

-- ── working tables (the drafts) ────────────────────────────────────────────

create table public.categories (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  blurb              text[] not null default '{}',
  position           int not null default 0,
  status             public.entity_status not null default 'draft',
  published_version  int,
  version            int not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         text
);
create trigger categories_stamp before update on public.categories
  for each row execute function public.stamp_row();

create table public.product_types (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories (id) on delete cascade,
  slug         text not null,
  name         text not null,
  unique (category_id, slug)
);

create table public.finishes (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  code               text not null unique,
  name               text not null,
  family             public.finish_family not null,
  swatch_path        text,
  status             public.finish_status not null default 'active',
  published_version  int,
  version            int not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         text
);
create trigger finishes_stamp before update on public.finishes
  for each row execute function public.stamp_row();

create table public.import_jobs (
  id          uuid primary key default gen_random_uuid(),
  entity      text not null check (entity in ('products', 'categories', 'finishes', 'product_finishes')),
  file_path   text not null,
  file_name   text not null,
  mapping     jsonb not null default '{}',
  options     jsonb not null default '{}',
  status      text not null default 'uploaded'
              check (status in ('uploaded', 'staging', 'staged', 'applying', 'applied', 'published', 'discarded', 'failed')),
  counts      jsonb not null default '{}',
  error       text,
  created_by  text not null default coalesce(auth.jwt() ->> 'email', 'system'),
  created_at  timestamptz not null default now(),
  applied_at  timestamptz
);

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  sku                text not null unique,
  slug               text not null unique,
  name               text not null,
  category_id        uuid not null references public.categories (id),
  type_id            uuid references public.product_types (id),
  description        text not null default '',
  dimensions         text,
  features           text[] not null default '{}',
  datasheet_path     text,
  status             public.entity_status not null default 'draft',
  featured           boolean not null default false,
  position           int not null default 0,
  published_version  int,
  -- Drafts written by an import carry its id, so an import can be published
  -- or discarded as one unit.
  import_job_id      uuid references public.import_jobs (id) on delete set null,
  version            int not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         text
);
create trigger products_stamp before update on public.products
  for each row execute function public.stamp_row();

create index products_category    on public.products (category_id, position);
create index products_status      on public.products (status);
create index products_updated     on public.products (updated_at desc);
create index products_import_job  on public.products (import_job_id) where import_job_id is not null;
create index products_name_trgm   on public.products using gin (name extensions.gin_trgm_ops);
create index products_sku_trgm    on public.products using gin (sku extensions.gin_trgm_ops);

-- One product, one item code, a list of finishes drawn from the library.
-- The two nullable columns are the room left for variants: a finish can take
-- its own photo or code later without a migration.
create table public.product_finishes (
  product_id     uuid not null references public.products (id) on delete cascade,
  finish_id      uuid not null references public.finishes (id),
  position       int not null default 0,
  image_path     text,
  code_override  text,
  primary key (product_id, finish_id)
);
create index product_finishes_finish on public.product_finishes (finish_id);

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  path        text not null,
  alt         text not null default '',
  caption     text,
  position    int not null default 0,
  width       int,
  height      int,
  created_at  timestamptz not null default now()
);
create index product_images_product on public.product_images (product_id, position);

-- ── history ────────────────────────────────────────────────────────────────

-- Every published version, immutable. Restoring copies a snapshot back into
-- the working tables as a draft.
create table public.revisions (
  id            bigint generated always as identity primary key,
  entity_type   text not null check (entity_type in ('product', 'category', 'finish')),
  entity_id     uuid not null,
  version       int not null,
  snapshot      jsonb not null,
  note          text,
  published_by  text,
  published_at  timestamptz not null default now()
);
create index revisions_entity on public.revisions (entity_type, entity_id, published_at desc);
create index revisions_recent on public.revisions (published_at desc);

-- ── the read model the public site reads ───────────────────────────────────

-- One row per published product. `snapshot` is the site's Product shape,
-- ready to render; the other columns exist so shelves can filter, sort and
-- page in SQL without unpacking the snapshot.
create table public.published_products (
  product_id     uuid primary key references public.products (id) on delete cascade,
  slug           text not null unique,
  sku            text not null,
  name           text not null,
  category_slug  text not null,
  type_slug      text,
  materials      text[] not null default '{}',
  finishes       text[] not null default '{}',
  finish_count   int not null default 0,
  position       int not null default 0,
  featured       boolean not null default false,
  status         public.entity_status not null,
  snapshot       jsonb not null,
  published_at   timestamptz not null default now()
);
create index published_products_shelf     on public.published_products (category_slug, status, position);
create index published_products_type      on public.published_products (type_slug);
create index published_products_materials on public.published_products using gin (materials);
create index published_products_finishes  on public.published_products using gin (finishes);
create index published_products_name_trgm on public.published_products using gin (name extensions.gin_trgm_ops);
create index published_products_sku_trgm  on public.published_products using gin (sku extensions.gin_trgm_ops);

create table public.published_categories (
  category_id   uuid primary key references public.categories (id) on delete cascade,
  slug          text not null unique,
  position      int not null default 0,
  status        public.entity_status not null,
  snapshot      jsonb not null,
  published_at  timestamptz not null default now()
);

create table public.published_finishes (
  finish_id     uuid primary key references public.finishes (id) on delete cascade,
  slug          text not null unique,
  status        public.finish_status not null,
  snapshot      jsonb not null,
  published_at  timestamptz not null default now()
);

-- Catalogue-wide numbers the site states, e.g. "596 products in the full
-- catalogue". One row.
create table public.catalogue_meta (
  id                      boolean primary key default true check (id),
  products_in_catalogue   int not null default 0,
  categories_in_catalogue int not null default 0,
  finishes_in_catalogue   int not null default 0,
  updated_at              timestamptz not null default now()
);

-- A product whose slug changed keeps its old URL working: the product page
-- looks here before returning a 404 and redirects permanently.
create table public.redirects (
  from_slug   text primary key,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── dashboard ──────────────────────────────────────────────────────────────

create table public.grid_views (
  id            uuid primary key default gen_random_uuid(),
  owner         text not null default coalesce(auth.jwt() ->> 'email', 'system'),
  name          text not null,
  shared        boolean not null default false,
  column_state  jsonb not null default '[]',
  filter_model  jsonb not null default '{}',
  sort_model    jsonb not null default '[]',
  created_at    timestamptz not null default now(),
  unique (owner, name)
);

create table public.import_rows (
  job_id      uuid not null references public.import_jobs (id) on delete cascade,
  row_number  int not null,
  raw         jsonb not null,
  parsed      jsonb,
  outcome     text check (outcome in ('new', 'changed', 'unchanged', 'error')),
  diff        jsonb,
  errors      text[] not null default '{}',
  primary key (job_id, row_number)
);
create index import_rows_outcome on public.import_rows (job_id, outcome);

create table public.mapping_presets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  entity      text not null,
  mapping     jsonb not null,
  created_by  text not null default coalesce(auth.jwt() ->> 'email', 'system'),
  created_at  timestamptz not null default now(),
  unique (entity, name)
);
