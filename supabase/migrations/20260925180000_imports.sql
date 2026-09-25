-- Import: staging bookkeeping, applying in transactions, discarding as a unit.

-- ── staging bookkeeping ───────────────────────────────────────────────────

alter table public.import_rows
  -- What identifies the row (an item code, a web address, an id), so a value
  -- that appears twice in a file is caught however the file is chunked.
  add column key          text,
  -- The version of the existing row the change was worked out against. If it
  -- has moved on by the time the import is applied, that row is refused
  -- rather than overwriting someone's newer edit.
  add column base_version int,
  -- The row the import wrote to, once applied.
  add column target_id    uuid,
  add column applied      boolean not null default false;

alter table public.import_rows drop constraint import_rows_outcome_check;
alter table public.import_rows add constraint import_rows_outcome_check
  check (outcome in ('new', 'changed', 'unchanged', 'skipped', 'error'));

create index import_rows_key on public.import_rows (job_id, key);
create index import_rows_pending on public.import_rows (job_id, row_number) where not applied;

-- save_product learns to tag what an import wrote.
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

  return saved;
end;
$$;

-- ── apply ────────────────────────────────────────────────────────────────
--
-- Applies up to p_limit of a job's staged rows, in one transaction: the whole
-- batch lands or none of it does. Each row's change was worked out at staging
-- (import_rows.parsed holds exactly the fields the sheet maps, already
-- resolved to ids); here it is written as a draft. A row whose target moved
-- on since staging is marked as an error instead, and the rest carry on.
--
-- Returns how many rows it applied, refused, and how many remain.

create function public.apply_import(p_job uuid, p_limit int default 200)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  job      public.import_jobs%rowtype;
  r        record;
  fields   jsonb;
  target   uuid;
  done     int := 0;
  refused  int := 0;
  left_    int;
  position int;
begin
  select * into job from public.import_jobs where id = p_job for update;
  if not found then
    raise exception 'No import %.', p_job using errcode = 'no_data_found';
  end if;

  for r in
    select * from public.import_rows
     where job_id = p_job and not applied and outcome in ('new', 'changed')
     order by row_number
     limit p_limit
  loop
    fields := coalesce(r.parsed -> 'fields', '{}');
    target := (r.parsed ->> 'id')::uuid;
    begin
      if job.entity in ('products', 'product_finishes') then
        if target is null then
          insert into public.products (sku, slug, name, category_id, type_id, description, dimensions,
                                       features, status, featured, import_job_id)
          values (fields ->> 'sku', fields ->> 'slug', fields ->> 'name', (fields ->> 'category_id')::uuid,
                  (fields ->> 'type_id')::uuid, coalesce(fields ->> 'description', ''), fields ->> 'dimensions',
                  coalesce(array(select jsonb_array_elements_text(fields -> 'features')), '{}'),
                  'draft', coalesce((fields ->> 'featured')::boolean, false), p_job)
          returning id into target;
          if r.parsed ? 'finishes' then
            insert into public.product_finishes (product_id, finish_id, position)
            select target, f.id::uuid, f.ord::int - 1
              from jsonb_array_elements_text(r.parsed -> 'finishes') with ordinality f(id, ord);
          end if;
        else
          perform public.save_product(
            target, r.base_version,
            fields || jsonb_build_object('import_job_id', p_job),
            case when r.parsed ? 'finishes'
              then array(select jsonb_array_elements_text(r.parsed -> 'finishes'))::uuid[] end);
        end if;

      elsif job.entity = 'finishes' then
        if target is null then
          insert into public.finishes (slug, code, name, family, status)
          values (fields ->> 'slug', fields ->> 'code', fields ->> 'name', fields ->> 'family',
                  coalesce((fields ->> 'status')::public.finish_status, 'active'))
          returning id into target;
        else
          update public.finishes f set
            slug   = coalesce(fields ->> 'slug', f.slug),
            code   = coalesce(fields ->> 'code', f.code),
            name   = coalesce(fields ->> 'name', f.name),
            family = coalesce(fields ->> 'family', f.family),
            status = coalesce((fields ->> 'status')::public.finish_status, f.status)
           where f.id = target and f.version = r.base_version;
          if not found then
            raise exception 'Someone else saved this finish first.' using errcode = 'PT409';
          end if;
        end if;

      elsif job.entity = 'categories' then
        if target is null then
          select coalesce(max(c.position), -1) + 1 into position from public.categories c;
          insert into public.categories (slug, name, blurb, status, position)
          values (fields ->> 'slug', fields ->> 'name',
                  coalesce(array(select jsonb_array_elements_text(fields -> 'blurb')), '{}'), 'draft', position)
          returning id into target;
        else
          perform public.save_category(target, r.base_version, fields, null);
        end if;
      end if;

      update public.import_rows set applied = true, target_id = target
       where job_id = p_job and row_number = r.row_number;
      done := done + 1;
    exception
      when sqlstate 'PT409' then
        update public.import_rows
           set applied = true, outcome = 'error',
               errors = errors || array['Someone changed this since the import was checked, so it was left alone. Check it again to include it.']
         where job_id = p_job and row_number = r.row_number;
        refused := refused + 1;
      when unique_violation then
        update public.import_rows
           set applied = true, outcome = 'error',
               errors = errors || array['Another row already uses this item code or web address.']
         where job_id = p_job and row_number = r.row_number;
        refused := refused + 1;
    end;
  end loop;

  select count(*) into left_ from public.import_rows
   where job_id = p_job and not applied and outcome in ('new', 'changed');

  update public.import_jobs
     set status = case when left_ = 0 then 'applied' else 'applying' end,
         applied_at = case when left_ = 0 then now() else applied_at end
   where id = p_job;

  return jsonb_build_object('applied', done, 'refused', refused, 'remaining', left_);
end;
$$;

revoke execute on function public.apply_import(uuid, int) from public, anon;
grant execute on function public.apply_import(uuid, int) to authenticated;

-- ── discard ──────────────────────────────────────────────────────────────
--
-- Undoes an applied import's drafts before they go live: anything it created
-- that was never published is deleted, and anything it changed goes back to
-- its live version. Products are restored through restore_product, so their
-- photos and finishes come back too. Only rows that still carry the import's
-- changes unpublished are touched; whatever has been published since stays.

create function public.discard_import(p_job uuid)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  job      public.import_jobs%rowtype;
  r        record;
  deleted  int := 0;
  reverted int := 0;
  rev      bigint;
  snap     jsonb;
begin
  select * into job from public.import_jobs where id = p_job for update;
  if not found then
    raise exception 'No import %.', p_job using errcode = 'no_data_found';
  end if;

  if job.entity in ('products', 'product_finishes') then
    for r in select p.* from public.products p where p.import_job_id = p_job loop
      if r.published_version is null then
        delete from public.products where id = r.id;
        deleted := deleted + 1;
      else
        select max(v.id) into rev from public.revisions v where v.entity_type = 'product' and v.entity_id = r.id;
        perform public.restore_product(r.id, rev, r.version);
        -- Back to exactly what is live: the featured flag too, which a version
        -- does not carry. Then it is marked as matching the live version,
        -- since it now does.
        update public.products p set import_job_id = null, featured = pp.featured
          from public.published_products pp where pp.product_id = p.id and p.id = r.id;
        update public.products set published_version = version where id = r.id;
        reverted := reverted + 1;
      end if;
    end loop;

  elsif job.entity = 'finishes' then
    for r in
      select f.* from public.finishes f
        join public.import_rows ir on ir.target_id = f.id and ir.job_id = p_job and ir.applied and ir.outcome in ('new', 'changed')
       where f.published_version is distinct from f.version
    loop
      if r.published_version is null then
        if not exists (select 1 from public.product_finishes where finish_id = r.id) then
          delete from public.finishes where id = r.id;
          deleted := deleted + 1;
        end if;
      else
        select s.snapshot into snap from public.published_finishes s where s.finish_id = r.id;
        update public.finishes set slug = snap ->> 'slug', code = snap ->> 'code', name = snap ->> 'name',
                                   family = snap ->> 'family', status = (snap ->> 'status')::public.finish_status
         where id = r.id;
        update public.finishes set published_version = version where id = r.id;
        reverted := reverted + 1;
      end if;
    end loop;

  elsif job.entity = 'categories' then
    for r in
      select c.* from public.categories c
        join public.import_rows ir on ir.target_id = c.id and ir.job_id = p_job and ir.applied and ir.outcome in ('new', 'changed')
       where c.published_version is distinct from c.version
    loop
      if r.published_version is null then
        if not exists (select 1 from public.products where category_id = r.id) then
          delete from public.categories where id = r.id;
          deleted := deleted + 1;
        end if;
      else
        select s.snapshot into snap from public.published_categories s where s.category_id = r.id;
        update public.categories
           set slug = snap ->> 'slug', name = snap ->> 'name',
               blurb = array(select jsonb_array_elements_text(snap -> 'blurb')),
               status = (snap ->> 'status')::public.entity_status
         where id = r.id;
        update public.categories set published_version = version where id = r.id;
        reverted := reverted + 1;
      end if;
    end loop;
  end if;

  update public.import_jobs set status = 'discarded' where id = p_job;
  return jsonb_build_object('deleted', deleted, 'reverted', reverted);
end;
$$;

revoke execute on function public.discard_import(uuid) from public, anon;
grant execute on function public.discard_import(uuid) to authenticated;
