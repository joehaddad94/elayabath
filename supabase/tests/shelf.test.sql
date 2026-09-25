-- The same cases as src/lib/product-filters.test.ts, against public.shelf().
-- If the two ever disagree, a category page means something different from
-- what its tests say it means.

begin;
select plan(17);

-- A clean slate inside this transaction. The local database may hold the
-- seeded catalogue and a real staff member; the rollback at the end puts all
-- of it back.
delete from public.published_products;
delete from public.published_categories;
delete from public.published_finishes;
delete from public.redirects;
delete from public.product_finishes;
delete from public.product_images;
delete from public.products;
delete from public.product_types;
delete from public.categories;
alter table public.staff disable trigger staff_guard_last;
delete from public.staff;
alter table public.staff enable trigger staff_guard_last;
delete from public.reserved_addresses;


insert into public.categories (id, slug, name, status)
values ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active');

insert into public.products (id, sku, slug, name, category_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'E10', 'e10', 'Brisa', '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-0000000000a2', 'E2',  'e2',  'Arco',  '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-0000000000a3', 'E30', 'e30', 'Dropo', '00000000-0000-0000-0000-00000000c001'),
  ('00000000-0000-0000-0000-0000000000a4', 'E99', 'old', 'Gone',  '00000000-0000-0000-0000-00000000c001');

-- Brisa (E10): free-standing, ceramic, one finish        position 0
-- Arco  (E2):  above-counter, solid surface, two finishes position 1
-- Dropo (E30): free-standing, ceramic + marble, two       position 2
insert into public.published_products
  (product_id, slug, sku, name, category_slug, type_slug, materials, finishes, finish_count, position, status, snapshot)
values
  ('00000000-0000-0000-0000-0000000000a1', 'e10', 'E10', 'Brisa', 'basins', 'free-standing', '{ceramic}',            '{c00-white}',        1, 0, 'active',
   '{"name":"Brisa","sku":"E10","type":{"slug":"free-standing","name":"Free standing"}}'),
  ('00000000-0000-0000-0000-0000000000a2', 'e2',  'E2',  'Arco',  'basins', 'above-counter', '{solid-surface}',      '{ss04-thunder,ss00}', 2, 1, 'active',
   '{"name":"Arco","sku":"E2","type":{"slug":"above-counter","name":"Above counter"}}'),
  ('00000000-0000-0000-0000-0000000000a3', 'e30', 'E30', 'Dropo', 'basins', 'free-standing', '{ceramic,marble}',     '{c00-white,m01}',    2, 2, 'active',
   '{"name":"Dropo","sku":"E30","type":{"slug":"free-standing","name":"Free standing"}}'),
  -- a discontinued product never appears on a shelf
  ('00000000-0000-0000-0000-0000000000a4', 'old', 'E99', 'Gone',  'basins', 'free-standing', '{ceramic}',            '{c00-white}',        1, 3, 'discontinued',
   '{"name":"Gone","sku":"E99"}');

create function pg_temp.names(result jsonb) returns text language sql as $$
  select string_agg(p ->> 'name', ',' order by ord)
  from jsonb_array_elements(result -> 'products') with ordinality as x(p, ord);
$$;
create function pg_temp.count_of(result jsonb, axis text, v text) returns int language sql as $$
  select coalesce((select (f ->> 'count')::int from jsonb_array_elements(result -> 'facets' -> axis) f
                   where f ->> 'value' = v), 0);
$$;

-- filterProducts
select is((public.shelf('basins') ->> 'total')::int, 3, 'nothing selected returns every live product');
select is((public.shelf('basins', '{free-standing,above-counter}') ->> 'total')::int, 3,
  'values within one axis are either/or');
select is(pg_temp.names(public.shelf('basins', '{free-standing}', '{marble}')), 'Dropo',
  'separate axes must all hold');
select is((public.shelf('basins', '{above-counter}', '{marble}') ->> 'total')::int, 0,
  'a selection can narrow to nothing');
select is(pg_temp.names(public.shelf('basins')) like '%Gone%', false,
  'discontinued products stay off the shelf');

-- facetCounts
select is(pg_temp.count_of(public.shelf('basins'), 'material', 'ceramic'), 2, 'ceramic counted twice');
select is(pg_temp.count_of(public.shelf('basins'), 'material', 'marble'), 1, 'marble counted once');
select is(pg_temp.count_of(public.shelf('basins'), 'material', 'solid-surface'), 1, 'solid surface counted once');
select is(pg_temp.count_of(public.shelf('basins', '{free-standing}'), 'material', 'ceramic'), 2,
  'counts narrow with another axis');
select is(pg_temp.count_of(public.shelf('basins', '{free-standing}'), 'material', 'solid-surface'), 0,
  'an option the other axes rule out reads zero');
select is(pg_temp.count_of(public.shelf('basins', '{}', '{marble}'), 'material', 'ceramic'), 2,
  'an axis ignores its own selection');

-- sortProducts
select is(pg_temp.names(public.shelf('basins')), 'Brisa,Arco,Dropo', 'default keeps catalogue order');
select is(pg_temp.names(public.shelf('basins', p_sort => 'name')), 'Arco,Brisa,Dropo', 'name A to Z');
select is(split_part(pg_temp.names(public.shelf('basins', p_sort => 'name-desc')), ',', 1), 'Dropo', 'name Z to A');
select is(split_part(pg_temp.names(public.shelf('basins', p_sort => 'finishes')), ',', 1), 'Arco',
  'most finishes first, ties in catalogue order');
select is(pg_temp.names(public.shelf('basins', p_sort => 'code')), 'Arco,Brisa,Dropo',
  'item codes compare numerically: E2 before E10');

-- paging
select is(pg_temp.names(public.shelf('basins', p_limit => 2, p_offset => 2)), 'Dropo',
  'paging returns the next slice');

select * from finish();
rollback;
