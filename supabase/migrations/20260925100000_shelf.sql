-- Category shelves, filtered, faceted, sorted and paged in SQL.
--
-- This used to run in the browser over every product in a category, via the
-- pure functions in src/lib/product-filters.ts. That is fine at 10 products
-- a category and not at 200 or 2,000. The meaning is unchanged, and
-- supabase/tests/shelf.test.sql repeats the cases in
-- src/lib/product-filters.test.ts against this function, so the two
-- implementations are held to one specification.
--
-- Semantics, from that module:
--   * within one axis, values are either/or; across axes, all must hold
--   * a facet's counts ignore its own axis, so they read as "what I would get
--     if I added this", and a ticked option never reads zero
--   * sorts: catalogue order, name either way, most finishes first (ties
--     keep catalogue order), and item code compared numerically (E2 < E10)

-- Natural ordering: digits compare as numbers. `_ci` also ignores case.
create collation if not exists public.natural (provider = icu, locale = 'en-u-kn-true');
create collation if not exists public.natural_ci (provider = icu, locale = 'en-u-kn-true-ks-level2', deterministic = false);

create function public.shelf(
  p_category  text,
  p_types     text[] default '{}',
  p_materials text[] default '{}',
  p_colours   text[] default '{}',
  p_sort      text   default 'default',
  p_limit     int    default 24,
  p_offset    int    default 0
) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with base as (
    select *
    from public.published_products
    where category_slug = p_category and status = 'active'
  ),
  flags as (
    select b.*,
      (cardinality(p_types) = 0     or b.type_slug = any (p_types))  as ok_type,
      (cardinality(p_materials) = 0 or b.materials && p_materials)   as ok_material,
      (cardinality(p_colours) = 0   or b.finishes && p_colours)      as ok_colour
    from base b
  ),
  matched as (
    select * from flags where ok_type and ok_material and ok_colour
  ),
  page as (
    select m.snapshot
    from matched m
    order by
      case when p_sort = 'name'      then m.name collate public.natural_ci end asc,
      case when p_sort = 'name-desc' then m.name collate public.natural_ci end desc,
      case when p_sort = 'finishes'  then m.finish_count end desc,
      case when p_sort = 'code'      then m.sku collate public.natural end asc,
      m.position, m.name collate public.natural_ci, m.sku
    limit greatest(p_limit, 0) offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from matched),
    'products', coalesce((select jsonb_agg(snapshot) from page), '[]'::jsonb),
    'facets', jsonb_build_object(
      'type', coalesce((
        select jsonb_agg(jsonb_build_object('value', t, 'label', l, 'count', n) order by n desc, l)
        from (
          select f.type_slug as t, max(f.snapshot -> 'type' ->> 'name') as l,
                 count(*) filter (where f.ok_material and f.ok_colour) as n
          from flags f where f.type_slug is not null group by f.type_slug
        ) x
      ), '[]'::jsonb),
      'material', coalesce((
        select jsonb_agg(jsonb_build_object('value', m, 'count', n) order by n desc, m)
        from (
          select m, count(*) filter (where f.ok_type and f.ok_colour) as n
          from flags f, unnest(f.materials) m group by m
        ) x
      ), '[]'::jsonb),
      'colour', coalesce((
        select jsonb_agg(jsonb_build_object('value', c, 'count', n) order by c)
        from (
          select c, count(*) filter (where f.ok_type and f.ok_material) as n
          from flags f, unnest(f.finishes) c group by c
        ) x
      ), '[]'::jsonb)
    )
  );
$$;

grant execute on function public.shelf(text, text[], text[], text[], text, int, int) to anon, authenticated;

-- Public search, server-side. The site used to send every visitor who opened
-- search the whole index; at tens of thousands of products that is far too
-- much. Same matching rules as src/lib/search.ts: every term must appear
-- somewhere, and an exact item code outranks everything.
create function public.search_catalogue(p_query text, p_limit int default 40) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with terms as (
    select array_agg(t) as t
    from unnest(regexp_split_to_array(lower(trim(p_query)), '\s+')) t
    where t <> ''
  ),
  compact as (
    select regexp_replace(lower(p_query), '[^a-z0-9]', '', 'g') as q
  ),
  hits as (
    select p.snapshot,
      case
        when regexp_replace(lower(p.sku), '[^a-z0-9]', '', 'g') = (select q from compact) then 0
        when length((select q from compact)) > 2
         and regexp_replace(lower(p.sku), '[^a-z0-9]', '', 'g') like (select q from compact) || '%' then 1
        when lower(p.name) = array_to_string((select t from terms), ' ') then 2
        when lower(p.name) like ((select t from terms))[1] || '%' then 3
        else 4
      end as rank
    from public.published_products p
    where p.status = 'active'
      and (select t from terms) is not null
      and not exists (
        select 1 from unnest((select t from terms)) term
        where position(term in lower(p.name || ' ' || p.sku || ' ' ||
          coalesce(p.snapshot -> 'type' ->> 'name', '') || ' ' ||
          coalesce(p.snapshot ->> 'categoryName', ''))) = 0
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           's', snapshot ->> 'slug', 'n', snapshot ->> 'name', 'k', snapshot ->> 'sku',
           't', snapshot -> 'type' ->> 'name', 'c', snapshot ->> 'categoryName'
         ) order by rank, snapshot ->> 'name'), '[]'::jsonb)
  from (select * from hits order by rank, snapshot ->> 'name' limit greatest(p_limit, 0)) h;
$$;

grant execute on function public.search_catalogue(text, int) to anon, authenticated;
