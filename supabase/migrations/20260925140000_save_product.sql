-- The product editor's save: a product's fields and its finishes in one
-- transaction, guarded by the version the editor loaded.
--
-- security invoker, so row-level security applies: staff only, as with every
-- other write. The version check is the conflict guard. A save against a
-- version someone else has moved on from is refused with SQLSTATE PT409,
-- which PostgREST answers as HTTP 409, and nothing is written.
--
-- Finishes are replaced as a set in the given order. A finish that stays
-- keeps its per-finish photo and code; only its position moves.

create function public.save_product(
  p_id       uuid,
  p_version  int,
  p_fields   jsonb,
  p_finishes uuid[] default null
) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  saved int;
begin
  update public.products p set
    sku         = coalesce(p_fields ->> 'sku', p.sku),
    slug        = coalesce(p_fields ->> 'slug', p.slug),
    name        = coalesce(p_fields ->> 'name', p.name),
    category_id = coalesce((p_fields ->> 'category_id')::uuid, p.category_id),
    type_id     = case when p_fields ? 'type_id' then (p_fields ->> 'type_id')::uuid else p.type_id end,
    description = coalesce(p_fields ->> 'description', p.description),
    dimensions  = case when p_fields ? 'dimensions' then p_fields ->> 'dimensions' else p.dimensions end,
    features    = case when p_fields ? 'features'
                    then array(select jsonb_array_elements_text(p_fields -> 'features'))
                    else p.features end,
    status      = coalesce((p_fields ->> 'status')::public.entity_status, p.status),
    featured    = coalesce((p_fields ->> 'featured')::boolean, p.featured)
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

  return saved;
end;
$$;

grant execute on function public.save_product(uuid, int, jsonb, uuid[]) to authenticated;

-- A draft that was never published can be deleted outright: nothing links to
-- it and nothing on the site shows it. Anything that has been published is
-- discontinued instead, which keeps its page and its history.
create function public.delete_draft_product(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.products where id = p_id and published_version is null;
  if not found then
    raise exception 'Only a product that has never been published can be deleted. Discontinue it instead.'
      using errcode = 'PT409';
  end if;
end;
$$;

grant execute on function public.delete_draft_product(uuid) to authenticated;
