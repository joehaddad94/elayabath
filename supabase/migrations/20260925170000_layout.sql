-- Categories, finishes and ordering.

-- ── order is layout, not an edit ──────────────────────────────────────────
--
-- Moving a product within its category, or a category within the menu, is
-- not a change to the product or category itself, and must not leave 150
-- drafts to publish. So a change of position alone no longer bumps the
-- version; ordering is published as a whole by the set_*_order functions
-- below, which write the working and live rows together.

create or replace function public.stamp_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Publishing records `published_version = version`. That is bookkeeping,
  -- not an edit: bumping the version here would make a row look unpublished
  -- the instant it was published.
  if new.published_version is distinct from old.published_version then
    return new;
  end if;
  -- A change of order and nothing else: layout, published on its own.
  if to_jsonb(new) <> to_jsonb(old)
     and (to_jsonb(new) - array['position', 'featured_rank'])
       = (to_jsonb(old) - array['position', 'featured_rank']) then
    return new;
  end if;
  new.version    := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end;
$$;

-- The homepage's featured products, in the order staff choose.
alter table public.products add column featured_rank int;
alter table public.published_products add column featured_rank int;

create function public.set_product_order(p_category uuid, p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  moved int;
begin
  if not public.can_publish() then
    raise exception 'Only staff can change the order.' using errcode = '42501';
  end if;
  -- The given products first, in the given order; any the list left out keep
  -- their relative order after them.
  with wanted as (
    select id, ord::int as rank from unnest(p_ids) with ordinality u(id, ord)
  ), ranked as (
    select p.id, (row_number() over (order by w.rank nulls last, p.position, p.name) - 1)::int as pos
      from public.products p left join wanted w on w.id = p.id
     where p.category_id = p_category
  )
  update public.products p set position = r.pos from ranked r where p.id = r.id and p.position <> r.pos;
  get diagnostics moved = row_count;
  update public.published_products pp set position = p.position
    from public.products p
   where pp.product_id = p.id and p.category_id = p_category and pp.position <> p.position;
  return moved;
end;
$$;

create function public.set_category_order(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  moved int;
begin
  if not public.can_publish() then
    raise exception 'Only staff can change the order.' using errcode = '42501';
  end if;
  with wanted as (
    select id, ord::int as rank from unnest(p_ids) with ordinality u(id, ord)
  ), ranked as (
    select c.id, (row_number() over (order by w.rank nulls last, c.position, c.name) - 1)::int as pos
      from public.categories c left join wanted w on w.id = c.id
  )
  update public.categories c set position = r.pos from ranked r where c.id = r.id and c.position <> r.pos;
  get diagnostics moved = row_count;
  update public.published_categories pc
     set position = c.position,
         snapshot = jsonb_set(pc.snapshot, '{position}', to_jsonb(c.position))
    from public.categories c
   where pc.category_id = c.id and pc.position <> c.position;
  return moved;
end;
$$;

create function public.set_featured_order(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_publish() then
    raise exception 'Only staff can change the order.' using errcode = '42501';
  end if;
  update public.products p
     set featured_rank = u.ord::int - 1
    from unnest(p_ids) with ordinality u(id, ord)
   where p.id = u.id and p.featured_rank is distinct from u.ord::int - 1;
  update public.products set featured_rank = null
   where featured_rank is not null and id <> all (p_ids);
  update public.published_products pp set featured_rank = p.featured_rank
    from public.products p
   where pp.product_id = p.id and pp.featured_rank is distinct from p.featured_rank;
  return coalesce(array_length(p_ids, 1), 0);
end;
$$;

revoke execute on function public.set_product_order(uuid, uuid[]) from public, anon;
revoke execute on function public.set_category_order(uuid[]) from public, anon;
revoke execute on function public.set_featured_order(uuid[]) from public, anon;
grant execute on function public.set_product_order(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.set_category_order(uuid[]) to authenticated, service_role;
grant execute on function public.set_featured_order(uuid[]) to authenticated, service_role;

-- ── categories ─────────────────────────────────────────────────────────────

-- A category's fields and its product types, saved together as a draft and
-- version-checked, like save_product. Types are given as a list: an entry
-- with an id renames that type, one without adds it, and a type left out is
-- removed, unless a product still uses it.
create function public.save_category(p_id uuid, p_version int, p_fields jsonb, p_types jsonb default null)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  saved  int;
  in_use text;
begin
  update public.categories c set
    name   = coalesce(p_fields ->> 'name', c.name),
    slug   = coalesce(p_fields ->> 'slug', c.slug),
    blurb  = case when p_fields ? 'blurb'
               then array(select jsonb_array_elements_text(p_fields -> 'blurb'))
               else c.blurb end,
    status = coalesce((p_fields ->> 'status')::public.entity_status, c.status)
  where c.id = p_id and c.version = p_version
  returning c.version into saved;

  if saved is null then
    if exists (select 1 from public.categories where id = p_id) then
      raise exception 'Someone else saved this category first.' using errcode = 'PT409';
    end if;
    raise exception 'No category %.', p_id using errcode = 'no_data_found';
  end if;

  if p_types is not null then
    select string_agg(t.name, ', ') into in_use
      from public.product_types t
     where t.category_id = p_id
       and t.id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_types) x where x ? 'id')
       and exists (select 1 from public.products p where p.type_id = t.id);
    if in_use is not null then
      raise exception 'Products still use %, so it can''t be removed. Move them to another type first.', in_use
        using errcode = 'PT422';
    end if;
    delete from public.product_types t
     where t.category_id = p_id
       and t.id not in (select (x ->> 'id')::uuid from jsonb_array_elements(p_types) x where x ? 'id');
    update public.product_types t set name = x ->> 'name'
      from jsonb_array_elements(p_types) x
     where x ? 'id' and t.id = (x ->> 'id')::uuid and t.category_id = p_id and t.name <> x ->> 'name';
    insert into public.product_types (category_id, slug, name)
    select p_id, x ->> 'slug', x ->> 'name'
      from jsonb_array_elements(p_types) x
     where not x ? 'id';
  end if;

  return saved;
end;
$$;

revoke execute on function public.save_category(uuid, int, jsonb, jsonb) from public, anon;
grant execute on function public.save_category(uuid, int, jsonb, jsonb) to authenticated;

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

  insert into public.revisions (entity_type, entity_id, version, snapshot, note, published_by)
  values ('category', p_id, c.version, snap, p_note, coalesce(auth.jwt() ->> 'email', 'system'));

  update public.categories set status = live, published_version = c.version where id = p_id;
  return c.version;
end;
$$;

-- ── finishes ───────────────────────────────────────────────────────────────

-- A finish nothing has ever used or published can be deleted; any other is
-- retired, which hides it from the picker and the site's filters while every
-- product that lists it keeps rendering it.
create function public.delete_unused_finish(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.product_finishes where finish_id = p_id)
     or exists (select 1 from public.finishes where id = p_id and published_version is not null) then
    raise exception 'This finish is in use or has been published. Retire it instead.' using errcode = 'PT409';
  end if;
  delete from public.finishes where id = p_id;
  if not found then
    raise exception 'No finish %.', p_id using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.delete_unused_finish(uuid) from public, anon;
grant execute on function public.delete_unused_finish(uuid) to authenticated;

-- How many products use each finish, for the library.
create view public.finish_usage
with (security_invoker = true) as
select f.id,
       count(pf.product_id)::int as products,
       count(pf.product_id) filter (where pp.product_id is not null)::int as live_products
  from public.finishes f
  left join public.product_finishes pf on pf.finish_id = f.id
  left join public.published_products pp on pp.product_id = pf.product_id and pp.status = 'active'
 group by f.id;

grant select on public.finish_usage to authenticated;

-- Featured products keep the order the homepage shows today (by name) as
-- their starting manual order.
with ranked as (
  select id, (row_number() over (order by name, sku) - 1)::int as rank
    from public.products where featured
)
update public.products p set featured_rank = r.rank from ranked r where p.id = r.id;
update public.published_products pp set featured_rank = p.featured_rank
  from public.products p where pp.product_id = p.id and p.featured_rank is not null;
