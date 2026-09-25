-- The product editor's writes: save_product (fields and finishes together,
-- version-checked) and delete_draft_product. Run with `npx supabase test db`.

begin;
select plan(18);

-- A clean slate inside this transaction; the rollback puts everything back.
delete from public.published_products;
delete from public.redirects;
delete from public.product_finishes;
delete from public.product_images;
delete from public.products;
delete from public.product_types;
delete from public.categories;
alter table public.staff disable trigger staff_guard_last;
delete from public.staff;
alter table public.staff enable trigger staff_guard_last;

-- ── fixtures, as the table owner ───────────────────────────────────────────

insert into public.staff (email) values ('owner@example.test');
insert into public.categories (id, slug, name, status)
values ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active');
insert into public.finishes (id, slug, code, name, family) values
  ('00000000-0000-0000-0000-00000000f001', 'white', 'T01', 'White', 'ceramic'),
  ('00000000-0000-0000-0000-00000000f002', 'black', 'T02', 'Black', 'ceramic'),
  ('00000000-0000-0000-0000-00000000f003', 'grey',  'T03', 'Grey',  'ceramic');
insert into public.products (id, sku, slug, name, category_id, status, published_version)
values
  ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'Basin', '00000000-0000-0000-0000-00000000c001', 'active', 1),
  ('00000000-0000-0000-0000-00000000d002', 'T-2', 't-2', 'Draft', '00000000-0000-0000-0000-00000000c001', 'draft', null);
insert into public.product_images (product_id, path, alt, position) values
  ('00000000-0000-0000-0000-00000000d001', 'products/t-1.webp', 'Old alt', 0),
  ('00000000-0000-0000-0000-00000000d001', 'products/t-1-side.webp', 'Side', 1);
insert into public.product_finishes (product_id, finish_id, position, image_path) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000f001', 0, 'photos/white.webp'),
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000f002', 1, null);

-- ── someone not on the staff list ──────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.test"}', true);

select throws_ok(
  $$ select public.save_product('00000000-0000-0000-0000-00000000d001', 1, '{"name":"Hijacked"}') $$,
  'P0002', null,
  'a non-staff save cannot even see the product, so it is refused as missing');
select throws_ok(
  $$ select public.delete_draft_product('00000000-0000-0000-0000-00000000d002') $$,
  'PT409', null,
  'a non-staff delete is refused');
select throws_ok($$ select * from public.storage_usage() $$, '42501', null,
  'a non-staff user cannot see storage usage');
select throws_ok($$ select * from public.unused_media() $$, '42501', null,
  'or the list of unused files');

-- ── a staff member ─────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);

select is(
  public.save_product(
    '00000000-0000-0000-0000-00000000d001', 1,
    '{"name":"Basin, renamed","dimensions":null,"features":["One","Two"]}',
    array['00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000f001']::uuid[]),
  2,
  'a save against the current version returns the next one');

select is((select name from public.products where sku = 'T-1'), 'Basin, renamed', 'fields are written');
select is((select features from public.products where sku = 'T-1'), array['One','Two'], 'features are written as a list');
select is((select updated_by from public.products where sku = 'T-1'), 'owner@example.test', 'the save is signed by who made it');
select is(
  (select array_agg(f.code order by pf.position) from public.product_finishes pf
     join public.finishes f on f.id = pf.finish_id
    where pf.product_id = '00000000-0000-0000-0000-00000000d001'),
  array['T03','T01'],
  'finishes are replaced as a set, in the order given');
select is(
  (select image_path from public.product_finishes
    where product_id = '00000000-0000-0000-0000-00000000d001'
      and finish_id = '00000000-0000-0000-0000-00000000f001'),
  'photos/white.webp',
  'a finish that stays keeps its own photo');

-- The gallery: reorder, drop one, add one, change alt text; and the data sheet.
select is(
  public.save_product(
    '00000000-0000-0000-0000-00000000d001', 2,
    '{"datasheet_path":"products/d001/sheet.pdf"}', null,
    '[{"path":"products/d001/new.webp","alt":"New","caption":"Front","width":1600,"height":1200},
      {"path":"products/t-1.webp","alt":"New alt","caption":""}]'),
  3,
  'a gallery change is a save like any other');
select is(
  (select array_agg(path || '=' || alt order by position) from public.product_images
    where product_id = '00000000-0000-0000-0000-00000000d001'),
  array['products/d001/new.webp=New', 'products/t-1.webp=New alt'],
  'the gallery is replaced as a set, in order, with its alt text');
select ok(
  (select width = 1600 and caption = 'Front' from public.product_images where path = 'products/d001/new.webp'),
  'a new photo keeps its size and caption');
select is((select datasheet_path from public.products where sku = 'T-1'), 'products/d001/sheet.pdf',
  'the data sheet is part of the save');

select throws_ok(
  $$ select public.save_product('00000000-0000-0000-0000-00000000d001', 1, '{"name":"Stale"}') $$,
  'PT409', null,
  'a save against a version someone has moved on from is refused');
select is((select name from public.products where sku = 'T-1'), 'Basin, renamed', 'and writes nothing');

select throws_ok(
  $$ select public.delete_draft_product('00000000-0000-0000-0000-00000000d001') $$,
  'PT409', null,
  'a product that has been published cannot be deleted');
select public.delete_draft_product('00000000-0000-0000-0000-00000000d002');
select is((select count(*) from public.products where sku = 'T-2')::int, 0, 'a never-published draft can be');

select * from finish();
rollback;
