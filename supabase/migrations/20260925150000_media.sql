-- Media: the gallery and data sheet become part of the product's draft, and
-- the dashboard can see what Storage holds and what nothing uses any more.

-- ── save_product, now with the gallery ────────────────────────────────────
--
-- Files are uploaded from the browser straight to Storage; this records which
-- of them the product uses, in order, with their alt text and captions. So a
-- gallery change is saved, version-checked and published exactly like a
-- change of name, and an upload that is never saved is simply unused.

drop function public.save_product(uuid, int, jsonb, uuid[]);

create function public.save_product(
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
    featured       = coalesce((p_fields ->> 'featured')::boolean, p.featured)
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

  return saved;
end;
$$;

grant execute on function public.save_product(uuid, int, jsonb, uuid[], jsonb) to authenticated;

-- ── what is in use ────────────────────────────────────────────────────────
--
-- A file is in use if the working copy uses it, if the live site uses it, or
-- if any published version in the history does: restoring an old version
-- must bring its photos back with it. Only files none of these name are
-- unused, which in practice means uploads that were never saved, and drafts'
-- files that were replaced before they were ever published.

create function public.media_in_use()
returns table (bucket_id text, name text)
language sql stable security definer set search_path = '' as $$
  -- working copy
  select 'product-media', path from public.product_images
  union select 'product-media', image_path from public.product_finishes where image_path is not null
  union select 'datasheets', datasheet_path from public.products where datasheet_path is not null
  union select 'swatches', swatch_path from public.finishes where swatch_path is not null
  -- the live site and every published version: both hold product snapshots
  union
  select b, p from (
    select s.snapshot from public.published_products s
    union all
    select r.snapshot from public.revisions r where r.entity_type = 'product'
  ) snaps,
  lateral (
    select 'product-media' as b, snaps.snapshot -> 'image' ->> 'path' as p
    union all
    select 'product-media', g ->> 'path' from jsonb_array_elements(coalesce(snaps.snapshot -> 'gallery', '[]')) g
    union all
    select 'product-media', v from jsonb_each_text(coalesce(snaps.snapshot -> 'finishImages', '{}')) e(k, v)
    union all
    select 'datasheets', snaps.snapshot ->> 'datasheet'
  ) refs
  where p is not null
  union
  select 'swatches', snap ->> 'image' from (
    select s.snapshot as snap from public.published_finishes s
    union all
    select r.snapshot from public.revisions r where r.entity_type = 'finish'
  ) f
  where snap ->> 'image' is not null;
$$;

revoke execute on function public.media_in_use() from public, anon;
grant execute on function public.media_in_use() to authenticated;

-- Files in the media buckets that nothing uses, older than the grace period.
-- The grace period covers an upload whose product has not been saved yet.
create function public.unused_media(p_grace interval default interval '1 day')
returns table (bucket_id text, name text, bytes bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  -- Staff, or the service key (scripts and the nightly job).
  if not public.can_publish() then
    raise exception 'Only staff can see storage.' using errcode = '42501';
  end if;
  return query
    select o.bucket_id, o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
      from storage.objects o
     where o.bucket_id in ('product-media', 'datasheets', 'swatches')
       and o.created_at < now() - p_grace
       and not exists (
         select 1 from public.media_in_use() u
          where u.bucket_id = o.bucket_id and u.name = o.name)
     order by o.created_at;
end;
$$;

revoke execute on function public.unused_media(interval) from public, anon;
grant execute on function public.unused_media(interval) to authenticated;

-- How much each bucket holds, for the storage meter.
create function public.storage_usage()
returns table (bucket_id text, files bigint, bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  -- Staff, or the service key (scripts and the nightly job).
  if not public.can_publish() then
    raise exception 'Only staff can see storage.' using errcode = '42501';
  end if;
  return query
    select o.bucket_id, count(*), coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
      from storage.objects o
     group by o.bucket_id
     order by o.bucket_id;
end;
$$;

revoke execute on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;
