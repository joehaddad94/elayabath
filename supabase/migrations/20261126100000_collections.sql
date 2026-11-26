-- Collections: Category → Collection → Product → Finish.
--
-- A collection is a named group of products inside one category (FLUX in
-- Tapware and FLUX in Showers are two collections). The site lists
-- collections where it used to list products; a product's own page and
-- address are unchanged.
--
-- A product with no collection is not on the site: publishing it takes it
-- off, exactly as hiding it does. So `published_products` only ever holds
-- products that have one, and every public read (shelves, search, the
-- sitemap, product pages) follows without a filter of its own.
--
-- This migration groups every existing product into a collection by its
-- name, one collection per name per category, and changes nothing else a
-- visitor can see: every product that was on the site stays on it.

-- ── the table ──────────────────────────────────────────────────────────────

create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories (id) on delete cascade,
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (btrim(name) <> ''),
  description  text not null default '',
  -- A photo in the site-media bucket. Without one, the site shows the
  -- photo of the collection's first product.
  image_path   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text,
  unique (category_id, slug)
);

create function public.stamp_collection() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end;
$$;
create trigger collections_stamp before update on public.collections
  for each row execute function public.stamp_collection();

alter table public.products
  add column collection_id uuid references public.collections (id);
create index products_collection on public.products (collection_id);

alter table public.published_products
  add column collection_id uuid references public.collections (id);
create index published_products_collection on public.published_products (collection_id, status, position);

-- ── who sees what ──────────────────────────────────────────────────────────

alter table public.collections enable row level security;

create policy "staff edit collections" on public.collections
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Visitors see a collection only once something in it is on the site, so a
-- collection being prepared stays private, like a hidden product.
create policy "anyone reads live collections" on public.collections
  for select to anon, authenticated
  using (exists (
    select 1 from public.published_products pp
     where pp.collection_id = collections.id and pp.status = 'active'
  ));

-- ── a collection belongs to the product's category ────────────────────────

-- Choosing a collection from another category is refused. Moving a product
-- to another category (the bulk move, an import) takes it out of its
-- collection, since that collection stays where it is; the product then
-- leaves the site until it is given one in its new category.
create function public.check_product_collection() returns trigger
language plpgsql set search_path = '' as $$
declare
  home uuid;
begin
  if new.collection_id is null then
    return new;
  end if;
  select c.category_id into home from public.collections c where c.id = new.collection_id;
  if home = new.category_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.collection_id is not distinct from old.collection_id then
    new.collection_id := null;
    return new;
  end if;
  raise exception 'That collection is in another category.' using errcode = 'PT422';
end;
$$;
create trigger products_collection_fits
  before insert or update of category_id, collection_id on public.products
  for each row execute function public.check_product_collection();

-- ── grouping products by name ──────────────────────────────────────────────

-- A collection's address from its name: "Aria Pro" becomes "aria-pro".
create function public.collection_slug(p_name text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'collection');
$$;

-- Puts every product that has no collection into one named after it, in
-- its own category: an existing collection with that address if there is
-- one, otherwise a new one. Names that differ only in case, spacing or
-- punctuation ("AXE C", "Axe-C") land in the same collection. Returns how
-- many products were placed. The products still need syncing to the site.
create function public.group_into_collections() returns int
language plpgsql security invoker set search_path = '' as $$
declare
  placed int;
begin
  insert into public.collections (category_id, slug, name)
  select p.category_id, public.collection_slug(p.name), mode() within group (order by btrim(p.name))
    from public.products p
   where p.collection_id is null
   group by p.category_id, public.collection_slug(p.name)
  on conflict (category_id, slug) do nothing;

  update public.products p
     set collection_id = c.id
    from public.collections c
   where p.collection_id is null
     and c.category_id = p.category_id
     and c.slug = public.collection_slug(p.name);
  get diagnostics placed = row_count;
  return placed;
end;
$$;

revoke execute on function public.group_into_collections() from public, anon;
grant execute on function public.group_into_collections() to authenticated, service_role;

-- ── saving and publishing ──────────────────────────────────────────────────

create or replace function public.save_product(
  p_id       uuid,
  p_version  int,
  p_fields   jsonb,
  p_finishes uuid[] default null,
  p_images   jsonb default null
) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  saved int;
begin
  update public.products p set
    sku            = coalesce(p_fields ->> 'sku', p.sku),
    slug           = coalesce(p_fields ->> 'slug', p.slug),
    name           = coalesce(p_fields ->> 'name', p.name),
    category_id    = coalesce((p_fields ->> 'category_id')::uuid, p.category_id),
    collection_id  = case when p_fields ? 'collection_id' then (p_fields ->> 'collection_id')::uuid else p.collection_id end,
    type_id        = case when p_fields ? 'type_id' then (p_fields ->> 'type_id')::uuid else p.type_id end,
    description    = coalesce(p_fields ->> 'description', p.description),
    dimensions     = case when p_fields ? 'dimensions' then p_fields ->> 'dimensions' else p.dimensions end,
    features       = case when p_fields ? 'features'
                       then array(select jsonb_array_elements_text(p_fields -> 'features'))
                       else p.features end,
    datasheet_path = case when p_fields ? 'datasheet_path' then p_fields ->> 'datasheet_path' else p.datasheet_path end,
    status         = coalesce((p_fields ->> 'status')::public.entity_status, p.status),
    featured       = coalesce((p_fields ->> 'featured')::boolean, p.featured),
    -- An import tags what it wrote, so it can be published or discarded as one.
    import_job_id  = case when p_fields ? 'import_job_id' then (p_fields ->> 'import_job_id')::uuid else p.import_job_id end
  where p.id = p_id and p.version = p_version
  returning p.version into saved;

  if saved is null then
    if exists (select 1 from public.products where id = p_id) then
      raise exception 'Someone else saved this product first.' using errcode = 'PT409';
    end if;
    raise exception 'No product %.', p_id using errcode = 'no_data_found';
  end if;

  if p_finishes is not null then
    delete from public.product_finishes
     where product_id = p_id and finish_id <> all (p_finishes);
    insert into public.product_finishes (product_id, finish_id, position)
    select p_id, f.id, f.ord::int - 1
      from unnest(p_finishes) with ordinality as f(id, ord)
    on conflict (product_id, finish_id) do update set position = excluded.position;
  end if;

  -- The gallery as a set, in order. A photo is identified by its path: the
  -- same file keeps its row (and its id), a new file gets one.
  if p_images is not null then
    delete from public.product_images
     where product_id = p_id
       and path not in (select i ->> 'path' from jsonb_array_elements(p_images) i);
    update public.product_images pi set
      position = g.ord::int - 1,
      alt      = coalesce(g.i ->> 'alt', ''),
      caption  = nullif(g.i ->> 'caption', '')
    from jsonb_array_elements(p_images) with ordinality as g(i, ord)
    where pi.product_id = p_id and pi.path = g.i ->> 'path';
    insert into public.product_images (product_id, path, alt, caption, position, width, height)
    select p_id, g.i ->> 'path', coalesce(g.i ->> 'alt', ''), nullif(g.i ->> 'caption', ''),
           g.ord::int - 1, (g.i ->> 'width')::int, (g.i ->> 'height')::int
      from jsonb_array_elements(p_images) with ordinality as g(i, ord)
     where not exists (
       select 1 from public.product_images pi
        where pi.product_id = p_id and pi.path = g.i ->> 'path');
  end if;

  -- A save that leaves the product exactly as it is live (content, the
  -- featured flag and its collection) has nothing left to publish, so it is
  -- marked as matching the live version: "unpublished changes" then always
  -- means a real one.
  if exists (
    select 1 from public.published_products pp
      join public.products p on p.id = pp.product_id
     where pp.product_id = p_id
       and pp.featured = p.featured
       and pp.collection_id is not distinct from p.collection_id
       and pp.snapshot = public.product_snapshot(p_id)
  ) then
    update public.products set published_version = version
     where id = p_id and published_version is distinct from version;
  end if;

  return saved;
end;
$$;

create or replace function public.publish_product(p_id uuid, p_note text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  p          public.products%rowtype;
  snap       jsonb;
  prior_slug text;
  live       public.entity_status;
begin
  if not public.can_publish() then
    raise exception 'Only staff can publish.' using errcode = '42501';
  end if;

  select * into p from public.products where id = p_id for update;
  if not found then
    raise exception 'No product %.', p_id using errcode = 'no_data_found';
  end if;

  -- No collection, no place on the site: take it off, as hiding does. It
  -- keeps its status, so giving it a collection and saving puts it back.
  if p.collection_id is null then
    delete from public.published_products where product_id = p_id;
    update public.products
       set published_version = p.version, import_job_id = null
     where id = p_id;
    return p.version;
  end if;

  -- Publishing a never-published draft makes it live.
  live := case when p.status = 'draft' then 'active'::public.entity_status else p.status end;
  snap := public.product_snapshot(p_id);

  -- A changed slug leaves a permanent redirect behind, so old links keep
  -- working. A slug reclaimed by its product no longer needs one.
  select slug into prior_slug from public.published_products where product_id = p_id;
  if prior_slug is not null and prior_slug <> p.slug then
    insert into public.redirects (from_slug, product_id) values (prior_slug, p_id)
      on conflict (from_slug) do update set product_id = excluded.product_id;
  end if;
  delete from public.redirects where from_slug = p.slug;

  insert into public.published_products as pp
    (product_id, slug, sku, name, category_slug, type_slug, materials, finishes,
     finish_count, position, featured, status, snapshot, published_at, collection_id)
  values (
    p_id, p.slug, p.sku, p.name,
    snap ->> 'categorySlug',
    snap -> 'type' ->> 'slug',
    array(select jsonb_array_elements_text(snap -> 'materials')),
    array(select jsonb_array_elements_text(snap -> 'finishes')),
    jsonb_array_length(snap -> 'finishes'),
    p.position, p.featured, live, snap, now(), p.collection_id
  )
  on conflict (product_id) do update set
    slug = excluded.slug, sku = excluded.sku, name = excluded.name,
    category_slug = excluded.category_slug, type_slug = excluded.type_slug,
    materials = excluded.materials, finishes = excluded.finishes,
    finish_count = excluded.finish_count, position = excluded.position,
    featured = excluded.featured, status = excluded.status,
    snapshot = excluded.snapshot, published_at = excluded.published_at,
    collection_id = excluded.collection_id;

  -- Publishing a version already in the history (again, with no edits in
  -- between) refreshes the live copy but adds no second, identical entry.
  if not exists (select 1 from public.revisions r
                  where r.entity_type = 'product' and r.entity_id = p_id and r.version = p.version) then
    insert into public.revisions (entity_type, entity_id, version, snapshot, note, published_by)
    values ('product', p_id, p.version, snap, p_note, coalesce(auth.jwt() ->> 'email', 'system'));
  end if;

  -- Bookkeeping only: the version trigger ignores this update.
  update public.products
     set status = live, published_version = p.version, import_job_id = null
   where id = p_id;

  return p.version;
end;
$$;

-- ── what the site reads ────────────────────────────────────────────────────

-- The collections on the site, each with its live product count and the
-- photo to show: its own, or else its first product's. In menu order, then
-- in catalogue order (where their first product sits). One category, or
-- all of them.
create function public.collection_cards(p_category text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(x.card order by x.category_position, x.first_position, x.name), '[]'::jsonb)
  from (
    select
      jsonb_build_object(
        'slug', c.slug,
        'name', c.name,
        'description', c.description,
        'categorySlug', pc.slug,
        'categoryName', pc.snapshot ->> 'name',
        'photo', c.image_path,
        'cover', n.cover,
        'count', n.products
      ) as card,
      pc.position as category_position,
      n.first_position,
      c.name
    from public.collections c
    join public.published_categories pc on pc.category_id = c.category_id and pc.status = 'active'
    join lateral (
      select count(*) as products,
             min(pp.position) as first_position,
             (array_agg(pp.snapshot -> 'image' order by pp.position, pp.name)
                filter (where jsonb_typeof(pp.snapshot -> 'image') = 'object'))[1] as cover
        from public.published_products pp
       where pp.collection_id = c.id and pp.status = 'active'
    ) n on n.products > 0
    where p_category is null or pc.slug = p_category
  ) x;
$$;

-- One collection and its live products, in catalogue order; null if it has
-- none on the site.
create function public.collection_page(p_category text, p_slug text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'slug', c.slug,
    'name', c.name,
    'description', c.description,
    'categorySlug', pc.slug,
    'categoryName', pc.snapshot ->> 'name',
    'photo', c.image_path,
    'products', ps.products
  )
  from public.collections c
  join public.published_categories pc on pc.category_id = c.category_id and pc.slug = p_category
  join lateral (
    select jsonb_agg(pp.snapshot order by pp.position, pp.name collate public.natural_ci, pp.sku) as products
      from public.published_products pp
     where pp.collection_id = c.id and pp.status = 'active'
  ) ps on ps.products is not null
  where c.slug = p_slug;
$$;

-- Collections whose name (with its category's) holds every word searched
-- for. Shown above the matching products.
create function public.search_collections(p_query text, p_limit int default 8) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with terms as (
    select array_agg(t) as t
    from unnest(regexp_split_to_array(lower(trim(p_query)), '\s+')) t
    where t <> ''
  ),
  hits as (
    select c.slug, c.name, pc.slug as category_slug, pc.snapshot ->> 'name' as category_name,
           pc.position as category_position,
           count(pp.product_id) as products,
           case
             when lower(c.name) = array_to_string((select t from terms), ' ') then 0
             when lower(c.name) like ((select t from terms))[1] || '%' then 1
             else 2
           end as rank
      from public.collections c
      join public.published_categories pc on pc.category_id = c.category_id and pc.status = 'active'
      join public.published_products pp on pp.collection_id = c.id and pp.status = 'active'
     where (select t from terms) is not null
       and not exists (
         select 1 from unnest((select t from terms)) term
          where position(term in lower(c.name || ' ' || (pc.snapshot ->> 'name'))) = 0
       )
     group by c.id, pc.slug, pc.snapshot, pc.position
     order by rank, c.name, pc.position
     limit greatest(p_limit, 0)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           's', slug, 'n', name, 'cs', category_slug, 'c', category_name, 'k', products
         ) order by rank, name, category_position), '[]'::jsonb)
  from hits;
$$;

grant execute on function public.collection_cards(text) to anon, authenticated;
grant execute on function public.collection_page(text, text) to anon, authenticated;
grant execute on function public.search_collections(text, int) to anon, authenticated;

-- ── the dashboard ──────────────────────────────────────────────────────────

-- The products grid gains the collection; columns can only be added at the
-- end of a view that is replaced.
create or replace view public.admin_products
with (security_invoker = true) as
select
  p.id,
  p.sku,
  p.slug,
  p.name,
  p.category_id,
  c.slug                                   as category_slug,
  c.name                                   as category_name,
  c.position                               as category_position,
  p.type_id,
  t.name                                   as type_name,
  p.status,
  p.featured,
  p.position,
  p.dimensions,
  p.datasheet_path is not null             as has_datasheet,
  img.path                                 as image_path,
  coalesce(fin.n, 0)::int                  as finish_count,
  (
    (img.path is not null)::int
    + (p.type_id is not null)::int
    + (coalesce(p.dimensions, '') <> '')::int
    + (coalesce(p.description, '') <> '')::int
    + (p.datasheet_path is not null)::int
    + (coalesce(fin.n, 0) > 0)::int
  )                                        as completeness,
  array_remove(array[
    case when img.path is null then 'photograph' end,
    case when p.type_id is null then 'product type' end,
    case when coalesce(p.dimensions, '') = '' then 'dimensions' end,
    case when coalesce(p.description, '') = '' then 'description' end,
    case when p.datasheet_path is null then 'data sheet' end,
    case when coalesce(fin.n, 0) = 0 then 'finishes' end
  ], null)                                 as missing,
  (p.published_version is null or p.version <> p.published_version) as has_changes,
  p.published_version,
  p.version,
  p.import_job_id,
  p.updated_at,
  p.updated_by,
  p.collection_id,
  col.name                                 as collection_name
from public.products p
join public.categories c on c.id = p.category_id
left join public.product_types t on t.id = p.type_id
left join public.collections col on col.id = p.collection_id
left join lateral (
  select i.path from public.product_images i
  where i.product_id = p.id
  order by i.position, i.created_at
  limit 1
) img on true
left join lateral (
  select count(*) as n from public.product_finishes pf where pf.product_id = p.id
) fin on true;

-- Products per collection, for the Collections screen.
create view public.collection_counts
with (security_invoker = true) as
select col.id as collection_id,
       count(p.id)::int as products,
       count(p.id) filter (where p.status = 'active')::int as live
  from public.collections col
  left join public.products p on p.collection_id = col.id
 group by col.id;

revoke all on public.collection_counts from anon;
grant select on public.collection_counts to authenticated;

-- ── the existing catalogue ────────────────────────────────────────────────

-- Every product goes into the collection named after it. This is
-- bookkeeping, not an edit, so the version trigger is held off: no product
-- should look as if it has changes waiting.
alter table public.products disable trigger products_stamp;
select public.group_into_collections();
alter table public.products enable trigger products_stamp;

update public.published_products pp
   set collection_id = p.collection_id
  from public.products p
 where p.id = pp.product_id;
