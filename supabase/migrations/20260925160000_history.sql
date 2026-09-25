-- History: restoring a published version, and tightening who can read drafts.

-- ── the snapshot answers staff only ───────────────────────────────────────
--
-- It builds a product from its working copy, drafts included. Anonymous
-- visitors could never call it; this also stops a signed-in account that is
-- no longer on the staff list, whose session may outlive its removal.

create or replace function public.product_snapshot(p_id uuid) returns jsonb
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
  where p.id = p_id
    and public.can_publish();
$$;

-- The save functions act as the caller under row-level security, so an
-- anonymous caller could never change anything; they are closed to
-- anonymous callers all the same, to say so plainly.
revoke execute on function public.save_product(uuid, int, jsonb, uuid[], jsonb) from public, anon;
revoke execute on function public.delete_draft_product(uuid) from public, anon;

-- ── restore ────────────────────────────────────────────────────────────────
--
-- Copies a published version back into the working copy, as a draft: it goes
-- live only when published again, so a restore can be checked first. It goes
-- through save_product, so it is version-checked like any other save, and
-- the photos come back with it because nothing a published version names is
-- ever treated as unused.
--
-- A snapshot stores slugs and paths, the site's shape, so each is looked up
-- again: a category, type or finish that has since been deleted is reported
-- (the category) or left out (a type, a finish) rather than guessed.
-- Featured and manual order are not part of a version and are left as they
-- are.

create function public.restore_product(p_id uuid, p_revision bigint, p_version int)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  snap     jsonb;
  category uuid;
  kind     uuid;
  finishes uuid[];
  gallery  jsonb;
  saved    int;
begin
  select r.snapshot into snap
    from public.revisions r
   where r.id = p_revision and r.entity_type = 'product' and r.entity_id = p_id;
  if snap is null then
    raise exception 'That version of this product does not exist.' using errcode = 'no_data_found';
  end if;

  select c.id into category from public.categories c where c.slug = snap ->> 'categorySlug';
  if category is null then
    raise exception 'The category this version was in (%) no longer exists.', snap ->> 'categoryName'
      using errcode = 'PT422';
  end if;

  -- An untyped product's snapshot carries its category as its type.
  select t.id into kind from public.product_types t
   where t.category_id = category and t.slug = snap -> 'type' ->> 'slug';

  if exists (select 1 from public.redirects r where r.from_slug = snap ->> 'slug' and r.product_id <> p_id) then
    raise exception 'This version''s web address now redirects to another product.' using errcode = 'PT422';
  end if;

  finishes := array(
    select f.id
      from jsonb_array_elements_text(coalesce(snap -> 'finishes', '[]')) with ordinality e(slug, ord)
      join public.finishes f on f.slug = e.slug
     order by e.ord);

  gallery := coalesce((
    select jsonb_agg(jsonb_build_object(
             'path', g ->> 'path', 'alt', coalesce(g ->> 'alt', ''), 'caption', g ->> 'caption',
             'width', g -> 'width', 'height', g -> 'height') order by x.ord)
      from jsonb_array_elements(coalesce(snap -> 'gallery', '[]')) with ordinality x(g, ord)
  ), '[]');

  saved := public.save_product(
    p_id, p_version,
    jsonb_build_object(
      'sku', snap ->> 'sku',
      'slug', snap ->> 'slug',
      'name', snap ->> 'name',
      'category_id', category,
      'type_id', kind,
      'description', coalesce(snap ->> 'description', ''),
      'dimensions', snap ->> 'dimensions',
      'features', coalesce(snap -> 'features', '[]'),
      'datasheet_path', snap ->> 'datasheet',
      'status', snap ->> 'status'),
    finishes,
    gallery);

  -- Per-finish photos, as they were in that version.
  update public.product_finishes pf
     set image_path = snap -> 'finishImages' ->> f.slug
    from public.finishes f
   where pf.product_id = p_id and pf.finish_id = f.id;

  return saved;
end;
$$;

revoke execute on function public.restore_product(uuid, bigint, int) from public, anon;
grant execute on function public.restore_product(uuid, bigint, int) to authenticated;
