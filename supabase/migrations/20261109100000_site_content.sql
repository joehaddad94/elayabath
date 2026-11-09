-- Site content: the website's own words and photos, edited on the dashboard.
--
-- One row per edited item, keyed by name ("home.lede", "photo.home.hero",
-- "seo.about.title"). Anything without a row shows the wording written in the
-- code (src/lib/i18n/dictionaries/en.ts), so an empty table is the site as it
-- was, and deleting a row is "use the original wording".
--
-- Like products, saving puts a change live: there is no draft. The site reads
-- this table directly (it is public text) and caches it until a save clears it.

create table public.site_content (
  key        text primary key check (key ~ '^[a-z][A-Za-z0-9_.-]{0,99}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.site_content is
  'Edited site text and photos, by key. A missing key shows the original wording from the code.';

alter table public.site_content enable row level security;

create policy "anyone reads site content" on public.site_content
  for select to anon, authenticated using (true);
create policy "staff edit site content" on public.site_content
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

-- ── saving ──────────────────────────────────────────────────────────────────
--
-- Sets and clears keys in one transaction, and returns what each key held
-- before, so the dashboard can offer "Undo this save" by saving those back.
-- A key that had no row comes back as null: undoing it clears it again.

create function public.save_site_content(p_set jsonb, p_clear text[] default '{}')
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  keys     text[];
  previous jsonb;
  who      text := coalesce(auth.jwt() ->> 'email', 'system');
begin
  if not public.is_staff() then
    raise exception 'Only staff can edit the site.' using errcode = '42501';
  end if;

  keys := array(select jsonb_object_keys(coalesce(p_set, '{}'))) || coalesce(p_clear, '{}');

  select coalesce(jsonb_object_agg(k, c.value), '{}')
    into previous
    from unnest(keys) k
    left join public.site_content c on c.key = k;

  insert into public.site_content (key, value, updated_at, updated_by)
  select e.key, e.value, now(), who
    from jsonb_each(coalesce(p_set, '{}')) e
  on conflict (key) do update set
    value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  delete from public.site_content where key = any (coalesce(p_clear, '{}'));

  return previous;
end;
$$;

revoke execute on function public.save_site_content(jsonb, text[]) from public, anon;
grant execute on function public.save_site_content(jsonb, text[]) to authenticated;

-- ── category photo and icon ─────────────────────────────────────────────────
--
-- The homepage's category tiles show a category's photo and icon, which had
-- no way to be changed. save_category now takes them, with the same version
-- check as every other category field. Values are either a site asset under
-- public/ ("/rooms/…") or a path in the site-media bucket.

create or replace function public.save_category(p_id uuid, p_version int, p_fields jsonb, p_types jsonb default null)
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
    image  = case when p_fields ? 'image' then p_fields ->> 'image' else c.image end,
    icon   = case when p_fields ? 'icon' then p_fields ->> 'icon' else c.icon end,
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

-- ── photos ──────────────────────────────────────────────────────────────────
--
-- Site photos and category tiles live in their own public bucket. Every
-- upload has a new name, so a replaced photo never overwrites the old one and
-- "Undo this save" can point back at it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('site-media', 'site-media', true, 10485760, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "staff upload site media" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_staff());
create policy "staff list site media" on storage.objects for select to authenticated
  using (bucket_id = 'site-media' and public.is_staff());
