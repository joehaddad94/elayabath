-- Categories, finishes and ordering. Run with `npx supabase test db`.

begin;
select plan(17);

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

insert into public.staff (email) values ('owner@example.test');
insert into public.categories (id, slug, name, status, position) values
  ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active', 0),
  ('00000000-0000-0000-0000-00000000c002', 'taps',   'Taps',   'active', 1);
insert into public.product_types (id, category_id, slug, name) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'counter', 'Counter basin'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000c001', 'spare',   'Spare type');
insert into public.finishes (id, slug, code, name, family) values
  ('00000000-0000-0000-0000-00000000f001', 'white', 'T01', 'White', 'ceramic'),
  ('00000000-0000-0000-0000-00000000f002', 'unused', 'T09', 'Unused', 'ceramic');
insert into public.products (id, sku, slug, name, category_id, type_id, status, position) values
  ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'Alpha', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000e001', 'draft', 0),
  ('00000000-0000-0000-0000-00000000d002', 'T-2', 't-2', 'Beta',  '00000000-0000-0000-0000-00000000c001', null, 'draft', 1),
  ('00000000-0000-0000-0000-00000000d003', 'T-3', 't-3', 'Gamma', '00000000-0000-0000-0000-00000000c001', null, 'draft', 2);
insert into public.product_finishes (product_id, finish_id) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000f001');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);

select public.publish_category('00000000-0000-0000-0000-00000000c001');
select public.publish_category('00000000-0000-0000-0000-00000000c002');
select public.publish_product(id) from public.products;

-- ── order is layout ──
select is(public.set_product_order('00000000-0000-0000-0000-00000000c001',
  array['00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000d001']::uuid[]), 3,
  'reordering a category moves each product whose place changed');
select is(
  (select array_agg(sku order by position) from public.products),
  array['T-3', 'T-1', 'T-2'],
  'the given products come first, the rest keep their order after them');
select is(
  (select array_agg(sku order by position) from public.published_products),
  array['T-3', 'T-1', 'T-2'],
  'and the live site has the same order at once');
select is((select count(*) from public.products where version <> published_version)::int, 0,
  'without leaving any product with unpublished changes');

select public.set_category_order(array['00000000-0000-0000-0000-00000000c002']::uuid[]);
select is((select array_agg(slug order by position) from public.published_categories), array['taps', 'basins'],
  'the menu order goes live, snapshot included');
select is((select (snapshot ->> 'position')::int from public.published_categories where slug = 'taps'), 0,
  'the category snapshot carries its new position');
select is((select count(*) from public.categories where version <> published_version)::int, 0,
  'again without leaving drafts');

select public.set_featured_order(array['00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d001']::uuid[]);
select is((select array_agg(sku order by featured_rank) from public.published_products where featured_rank is not null),
  array['T-2', 'T-1'], 'the homepage order goes live');
select public.set_featured_order(array['00000000-0000-0000-0000-00000000d001']::uuid[]);
select is((select count(*) from public.products where featured_rank is not null)::int, 1,
  'a product left out of the homepage order loses its place');

-- A real edit still counts as one.
update public.products set name = 'Alpha, renamed' where sku = 'T-1';
select ok((select version > published_version from public.products where sku = 'T-1'), 'an edit still makes a draft');

-- ── categories and their types ──
select is(
  public.save_category('00000000-0000-0000-0000-00000000c001', 1,
    '{"name":"Basins","blurb":["One.","Two."]}',
    '[{"id":"00000000-0000-0000-0000-00000000e001","name":"Countertop basin"},{"name":"Wall hung","slug":"wall-hung"}]'),
  2, 'a category saves with its types, version-checked');
select is(
  (select array_agg(name order by name) from public.product_types where category_id = '00000000-0000-0000-0000-00000000c001'),
  array['Countertop basin', 'Wall hung'], 'types are renamed, added, and an unused one removed');
select throws_ok(
  $$ select public.save_category('00000000-0000-0000-0000-00000000c001', 2, '{}', '[]') $$,
  'PT422', null, 'a type products still use cannot be removed');
select throws_ok(
  $$ select public.save_category('00000000-0000-0000-0000-00000000c001', 1, '{"name":"Stale"}') $$,
  'PT409', null, 'a stale category save is refused');

select public.publish_category('00000000-0000-0000-0000-00000000c001');
select is((select snapshot -> 'type' ->> 'name' from public.published_products where sku = 'T-1'), 'Countertop basin',
  'publishing the category renames the type on its live products');

-- ── finishes ──
select throws_ok($$ select public.delete_unused_finish('00000000-0000-0000-0000-00000000f001') $$, 'PT409', null,
  'a finish in use cannot be deleted');
select public.delete_unused_finish('00000000-0000-0000-0000-00000000f002');
select is((select count(*) from public.finishes where code = 'T09')::int, 0, 'an unused, unpublished one can');

select * from finish();
rollback;
