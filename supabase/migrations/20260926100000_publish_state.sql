-- Publishing state that means what it says.

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

  -- A save that leaves the product exactly as it is live (content and the
  -- featured flag) has nothing left to publish, so it is marked as matching
  -- the live version: "unpublished changes" then always means a real one.
  if exists (
    select 1 from public.published_products pp
      join public.products p on p.id = pp.product_id
     where pp.product_id = p_id
       and pp.featured = p.featured
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

create or replace function public.publish_category(p_id uuid, p_note text default null) returns int
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

  -- Likewise the names of the category's product types. A type is known by
  -- its slug, which never changes; only its name is edited. Matching on the
  -- published slug (not on each product's working type) keeps unpublished
  -- product edits out of this.
  update public.published_products pp
     set snapshot = jsonb_set(pp.snapshot, '{type}', jsonb_build_object('slug', t.slug, 'name', t.name))
    from public.product_types t
   where t.category_id = p_id
     and pp.category_slug = c.slug
     and pp.snapshot -> 'type' ->> 'slug' = t.slug
     and pp.snapshot -> 'type' ->> 'name' is distinct from t.name;

  -- Publishing a version already in the history (again, with no edits in
  -- between) refreshes the live copy but adds no second, identical entry.
  if not exists (select 1 from public.revisions r
                  where r.entity_type = 'category' and r.entity_id = p_id and r.version = c.version) then
    insert into public.revisions (entity_type, entity_id, version, snapshot, note, published_by)
    values ('category', p_id, c.version, snap, p_note, coalesce(auth.jwt() ->> 'email', 'system'));
  end if;

  update public.categories set status = live, published_version = c.version where id = p_id;
  return c.version;
end;
$$;

create or replace function public.publish_finish(p_id uuid, p_note text default null) returns int
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

  -- Publishing a version already in the history (again, with no edits in
  -- between) refreshes the live copy but adds no second, identical entry.
  if not exists (select 1 from public.revisions r
                  where r.entity_type = 'finish' and r.entity_id = p_id and r.version = f.version) then
    insert into public.revisions (entity_type, entity_id, version, snapshot, note, published_by)
    values ('finish', p_id, f.version, snap, p_note, coalesce(auth.jwt() ->> 'email', 'system'));
  end if;

  update public.finishes set published_version = f.version where id = p_id;
  return f.version;
end;
$$;

-- Products already identical to their live version but marked as changed
-- (a save with no real edit, or a restore of the live version) are marked
-- as matching it. The snapshot function answers the service role only, so
-- this runs as it.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.products p
   set published_version = p.version
  from public.published_products pp
 where pp.product_id = p.id
   and p.published_version is distinct from p.version
   and pp.featured = p.featured
   and pp.snapshot = public.product_snapshot(p.id);
