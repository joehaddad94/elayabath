-- Publishing: turning a draft into what the public site reads.
--
-- One function per entity, each a single transaction: the snapshot, the
-- history row, the read model, the redirect and the published marker all
-- commit together or not at all. The seed publishes the scraped catalogue
-- through these same functions, so the path the dashboard's Publish button
-- takes is the path every published row has already been through.

alter table public.categories
  add column image text,   -- a site asset under public/, e.g. /rooms/room-washbasins.webp
  add column icon  text;   -- likewise, e.g. /icons/icon-tapware.png

-- Who may publish: staff, or the service key (the seed, the nightly job).
create function public.can_publish() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff()
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

-- ── products ───────────────────────────────────────────────────────────────

-- The snapshot is the site's Product shape, built here from the working rows
-- so it can never disagree with them. Image and file references are storage
-- paths; the site turns them into URLs, so the host can change freely.
create function public.product_snapshot(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'sku',          p.sku,
    'slug',         p.slug,
    'name',         p.name,
    'categorySlug', c.slug,
    'categoryName', c.name,
    'type',         case when t.id is null
                      then jsonb_build_object('slug', c.slug, 'name', c.name)
                      else jsonb_build_object('slug', t.slug, 'name', t.name) end,
    'dimensions',   p.dimensions,
    'description',  p.description,
    'features',     to_jsonb(p.features),
    'status',       case when p.status = 'draft' then 'active' else p.status::text end,
    'image', (
      select jsonb_build_object('path', i.path, 'width', i.width, 'height', i.height, 'alt', i.alt)
      from public.product_images i where i.product_id = p.id
      order by i.position, i.created_at limit 1
    ),
    'gallery', coalesce((
      select jsonb_agg(jsonb_build_object(
               'path', i.path, 'width', i.width, 'height', i.height,
               'alt', i.alt, 'caption', i.caption)
             order by i.position, i.created_at)
      from public.product_images i where i.product_id = p.id
    ), '[]'::jsonb),
    'finishes', coalesce((
      select jsonb_agg(f.slug order by pf.position, f.slug)
      from public.product_finishes pf join public.finishes f on f.id = pf.finish_id
      where pf.product_id = p.id
    ), '[]'::jsonb),
    'finishImages', coalesce((
      select jsonb_object_agg(f.slug, pf.image_path)
      from public.product_finishes pf join public.finishes f on f.id = pf.finish_id
      where pf.product_id = p.id and pf.image_path is not null
    ), '{}'::jsonb),
    'materials', coalesce((
      select jsonb_agg(distinct f.family::text)
      from public.product_finishes pf join public.finishes f on f.id = pf.finish_id
      where pf.product_id = p.id
    ), '[]'::jsonb),
    'datasheet', p.datasheet_path
  )
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.product_types t on t.id = p.type_id
  where p.id = p_id;
$$;

create function public.publish_product(p_id uuid, p_note text default null) returns int
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

  -- Publishing a never-published draft makes it live. A discontinued product
  -- stays discontinued: its page keeps working, it just leaves the listings.
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
     finish_count, position, featured, status, snapshot, published_at)
  values (
    p_id, p.slug, p.sku, p.name,
    snap ->> 'categorySlug',
    snap -> 'type' ->> 'slug',
    array(select jsonb_array_elements_text(snap -> 'materials')),
    array(select jsonb_array_elements_text(snap -> 'finishes')),
    jsonb_array_length(snap -> 'finishes'),
    p.position, p.featured, live, snap, now()
  )
  on conflict (product_id) do update set
    slug = excluded.slug, sku = excluded.sku, name = excluded.name,
    category_slug = excluded.category_slug, type_slug = excluded.type_slug,
    materials = excluded.materials, finishes = excluded.finishes,
    finish_count = excluded.finish_count, position = excluded.position,
    featured = excluded.featured, status = excluded.status,
    snapshot = excluded.snapshot, published_at = excluded.published_at;

  insert into public.revisions (entity_type, entity_id, version, snapshot, note, published_by)
  values ('product', p_id, p.version, snap, p_note, coalesce(auth.jwt() ->> 'email', 'system'));

  -- Bookkeeping only: the version trigger ignores this update.
  update public.products
     set status = live, published_version = p.version, import_job_id = null
   where id = p_id;

  return p.version;
end;
$$;

-- ── categories ─────────────────────────────────────────────────────────────

create function public.publish_category(p_id uuid, p_note text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  c    public.categories%rowtype;
  snap jsonb;
  live public.entity_status;
begin
  if not public.can_publish() then
    raise exception 'Only staff can publish.' using errcode = '42501';
  end if;

  select * into c from public.categories where id = p_id for update;
  if not found then
    raise exception 'No category %.', p_id using errcode = 'no_data_found';
  end if;

  live := case when c.status = 'draft' then 'active'::public.entity_status else c.status end;
  snap := jsonb_build_object(
    'slug', c.slug, 'name', c.name, 'blurb', to_jsonb(c.blurb),
    'image', c.image, 'icon', c.icon, 'position', c.position, 'status', live::text
  );

  insert into public.published_categories (category_id, slug, position, status, snapshot, published_at)
  values (p_id, c.slug, c.position, live, snap, now())
  on conflict (category_id) do update set
    slug = excluded.slug, position = excluded.position, status = excluded.status,
    snapshot = excluded.snapshot, published_at = excluded.published_at;

  -- Published products carry their category's slug and name. Keep them in
  -- step, so renaming a category does not wait on republishing its products.
  update public.published_products pp
     set category_slug = c.slug,
         snapshot = pp.snapshot
           || jsonb_build_object('categorySlug', c.slug, 'categoryName', c.name)
   where pp.product_id in (select id from public.products where category_id = p_id);

  insert into public.revisions (entity_type, entity_id, version, snapshot, note, published_by)
  values ('category', p_id, c.version, snap, p_note, coalesce(auth.jwt() ->> 'email', 'system'));

  update public.categories set status = live, published_version = c.version where id = p_id;
  return c.version;
end;
$$;

-- ── finishes ───────────────────────────────────────────────────────────────

create function public.publish_finish(p_id uuid, p_note text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  f          public.finishes%rowtype;
  snap       jsonb;
  prior_slug text;
begin
  if not public.can_publish() then
    raise exception 'Only staff can publish.' using errcode = '42501';
  end if;

  select * into f from public.finishes where id = p_id for update;
  if not found then
    raise exception 'No finish %.', p_id using errcode = 'no_data_found';
  end if;

  snap := jsonb_build_object(
    'slug', f.slug, 'code', f.code, 'name', f.name, 'family', f.family::text,
    'image', f.swatch_path, 'status', f.status::text
  );

  select slug into prior_slug from public.published_finishes where finish_id = p_id;

  insert into public.published_finishes (finish_id, slug, status, snapshot, published_at)
  values (p_id, f.slug, f.status, snap, now())
  on conflict (finish_id) do update set
    slug = excluded.slug, status = excluded.status,
    snapshot = excluded.snapshot, published_at = excluded.published_at;

  -- Published products list finishes by slug. If the slug changed, follow it.
  if prior_slug is not null and prior_slug <> f.slug then
    update public.published_products pp
       set finishes = array_replace(pp.finishes, prior_slug, f.slug),
           snapshot = jsonb_set(pp.snapshot, '{finishes}',
             to_jsonb(array_replace(
               array(select jsonb_array_elements_text(pp.snapshot -> 'finishes')),
               prior_slug, f.slug)))
     where prior_slug = any (pp.finishes);
  end if;

  insert into public.revisions (entity_type, entity_id, version, snapshot, note, published_by)
  values ('finish', p_id, f.version, snap, p_note, coalesce(auth.jwt() ->> 'email', 'system'));

  update public.finishes set published_version = f.version where id = p_id;
  return f.version;
end;
$$;

revoke execute on function public.can_publish()                from public;
revoke execute on function public.product_snapshot(uuid)        from public, anon;
revoke execute on function public.publish_product(uuid, text)   from public, anon;
revoke execute on function public.publish_category(uuid, text)  from public, anon;
revoke execute on function public.publish_finish(uuid, text)    from public, anon;
grant  execute on function public.can_publish()                to authenticated, service_role;
grant  execute on function public.product_snapshot(uuid)        to authenticated, service_role;
grant  execute on function public.publish_product(uuid, text)   to authenticated, service_role;
grant  execute on function public.publish_category(uuid, text)  to authenticated, service_role;
grant  execute on function public.publish_finish(uuid, text)    to authenticated, service_role;
