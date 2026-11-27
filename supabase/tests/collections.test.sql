-- Collections: grouping by name, the rule that a product without one is off
-- the site, the category check, and what visitors can read.

begin;
select plan(16);

delete from public.published_products;
delete from public.published_categories;
delete from public.redirects;
delete from public.revisions;
delete from public.product_finishes;
delete from public.product_images;
delete from public.products;
delete from public.product_types;
delete from public.categories;
alter table public.staff disable trigger staff_guard_last;
delete from public.staff;
alter table public.staff enable trigger staff_guard_last;

insert into public.staff (email, role) values ('owner@example.test', 'owner');
insert into public.categories (id, slug, name, status, position) values
  ('00000000-0000-0000-0000-00000000c001', 'tapware', 'Tapware', 'active', 0),
  ('00000000-0000-0000-0000-00000000c002', 'showers', 'Showers', 'active', 1);
insert into public.products (id, sku, slug, name, category_id, status, position) values
  ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'FLUX',   '00000000-0000-0000-0000-00000000c001', 'draft', 0),
  ('00000000-0000-0000-0000-00000000d002', 'T-2', 't-2', ' Flux ', '00000000-0000-0000-0000-00000000c001', 'draft', 1),
  ('00000000-0000-0000-0000-00000000d003', 'T-3', 't-3', 'FLUX',   '00000000-0000-0000-0000-00000000c002', 'draft', 0),
  ('00000000-0000-0000-0000-00000000d004', 'T-4', 't-4', 'ARIA',   '00000000-0000-0000-0000-00000000c001', 'draft', 2);

select is(public.group_into_collections(), 4, 'every product is placed');
select is((select count(*)::int from public.collections), 3, 'one collection per name per category');
select is(
  (select count(distinct collection_id)::int from public.products where name ilike '%flux%' and category_id = '00000000-0000-0000-0000-00000000c001'),
  1, 'names differing in case and spacing share a collection');
select is(public.group_into_collections(), 0, 'grouping again changes nothing');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.publish_category(id) from public.categories;
select public.publish_product(id) from public.products where sku <> 'T-4';

-- Visitors: a collection is visible only once something in it is live.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.collections), 2, 'visitors see only collections with a live product');
select is(jsonb_array_length(public.collection_cards()), 2, 'cards for every live collection');
select is(public.collection_cards('tapware') -> 0 ->> 'count', '2', 'a card counts its live products');
select is(jsonb_array_length(public.collection_page('tapware', 'flux') -> 'products'), 2, 'a collection page lists its live products');
select ok(public.collection_page('tapware', 'aria') is null, 'a collection with nothing live has no page');
select is(
  (select string_agg(h ->> 'c', ',' order by o) from jsonb_array_elements(public.search_collections('flux')) with ordinality x(h, o)),
  'Tapware,Showers', 'search finds a collection in every category, in menu order');
select is(jsonb_array_length(public.search_collections('flux show')), 1, 'adding the category narrows it');
reset role;

-- Staff: a collection must be in the product's category.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);
select throws_ok(
  $$update public.products set collection_id = (select id from public.collections where category_id = '00000000-0000-0000-0000-00000000c002')
     where id = '00000000-0000-0000-0000-00000000d001'$$,
  'PT422', 'That collection is in another category.', 'a collection from another category is refused');

update public.products set category_id = '00000000-0000-0000-0000-00000000c002', type_id = null
 where id = '00000000-0000-0000-0000-00000000d002';
select ok((select collection_id is null from public.products where id = '00000000-0000-0000-0000-00000000d002'),
  'moving a product to another category takes it out of its collection');
select public.sync_product('00000000-0000-0000-0000-00000000d002');
select ok(not exists (select 1 from public.published_products where product_id = '00000000-0000-0000-0000-00000000d002'),
  'a product without a collection is off the site');
select is((select status::text from public.products where id = '00000000-0000-0000-0000-00000000d002'), 'active',
  'and keeps its status, so a collection puts it back');

select public.group_into_collections();
select public.sync_product('00000000-0000-0000-0000-00000000d002');
select ok(exists (select 1 from public.published_products where product_id = '00000000-0000-0000-0000-00000000d002'
                   and collection_id = (select collection_id from public.products where id = '00000000-0000-0000-0000-00000000d002')),
  'given a collection, it is back on the site');

select * from finish();
rollback;
