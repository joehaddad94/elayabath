-- Restoring a published version, and who may read a draft's snapshot.
-- Run with `npx supabase test db`.

begin;
select plan(11);

delete from public.published_products;
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
insert into public.categories (id, slug, name, status)
values ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active');
insert into public.product_types (id, category_id, slug, name)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'counter', 'Counter basin');
insert into public.finishes (id, slug, code, name, family) values
  ('00000000-0000-0000-0000-00000000f001', 'white', 'T01', 'White', 'ceramic'),
  ('00000000-0000-0000-0000-00000000f002', 'black', 'T02', 'Black', 'ceramic');
insert into public.products (id, sku, slug, name, category_id, type_id, description, dimensions, status)
values ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'Basin',
        '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000e001',
        'The first description.', '600 x 400 mm', 'draft');
insert into public.product_finishes (product_id, finish_id, position, image_path) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000f001', 0, 'finishes/t-1--white.webp');
insert into public.product_images (product_id, path, alt, position) values
  ('00000000-0000-0000-0000-00000000d001', 'products/t-1.webp', 'Basin', 0);

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);

-- Version 1 goes live; then the draft moves on.
select public.publish_product('00000000-0000-0000-0000-00000000d001', 'first');
select public.save_product(
  '00000000-0000-0000-0000-00000000d001', 1,
  '{"name":"Basin, renamed","description":"A new description.","dimensions":null,"type_id":null}',
  array['00000000-0000-0000-0000-00000000f002']::uuid[],
  '[{"path":"products/d001/new.webp","alt":"New"}]');

select is(
  public.restore_product('00000000-0000-0000-0000-00000000d001',
    (select id from public.revisions where entity_id = '00000000-0000-0000-0000-00000000d001'), 2),
  3,
  'restoring a version is a save: it returns the next version');
select is((select name from public.products where sku = 'T-1'), 'Basin', 'the name comes back');
select is((select description || ' / ' || dimensions from public.products where sku = 'T-1'),
  'The first description. / 600 x 400 mm', 'so do the description and dimensions');
select is((select type_id from public.products where sku = 'T-1'), '00000000-0000-0000-0000-00000000e001'::uuid,
  'the type is found again by its slug');
select is(
  (select array_agg(f.code || '=' || coalesce(pf.image_path, '')) from public.product_finishes pf
     join public.finishes f on f.id = pf.finish_id where pf.product_id = '00000000-0000-0000-0000-00000000d001'),
  array['T01=finishes/t-1--white.webp'],
  'the finishes come back, each with its own photo');
select is(
  (select array_agg(path) from public.product_images where product_id = '00000000-0000-0000-0000-00000000d001'),
  array['products/t-1.webp'],
  'the gallery comes back');
select ok(
  (select published_version = 1 and version = 3 from public.products where sku = 'T-1'),
  'as a draft: the live version is still 1 until it is published again');

select throws_ok(
  $$ select public.restore_product('00000000-0000-0000-0000-00000000d001',
       (select id from public.revisions where entity_id = '00000000-0000-0000-0000-00000000d001'), 2) $$,
  'PT409', null,
  'a restore against an old version of the draft is refused, like any stale save');

-- A category that no longer exists under its old address can't be guessed.
reset role;
update public.categories set slug = 'washbasins' where id = '00000000-0000-0000-0000-00000000c001';
set local role authenticated;
select throws_ok(
  $$ select public.restore_product('00000000-0000-0000-0000-00000000d001',
       (select id from public.revisions where entity_id = '00000000-0000-0000-0000-00000000d001'), 3) $$,
  'PT422', null,
  'a version whose category is gone is refused with the reason');

select isnt(public.product_snapshot('00000000-0000-0000-0000-00000000d001'), null,
  'staff can read a draft''s snapshot');

-- A signed-in account no longer on the staff list reads nothing.
select set_config('request.jwt.claims', '{"role":"authenticated","email":"former@example.test"}', true);
select is(public.product_snapshot('00000000-0000-0000-0000-00000000d001'), null,
  'an account off the staff list cannot read a draft''s snapshot');

select * from finish();
rollback;
