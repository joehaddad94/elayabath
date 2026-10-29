-- Saving puts a change live: sync_product makes the site match the working
-- copy, and a hidden product is off the site entirely.

begin;
select plan(15);

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

insert into public.staff (email, role) values ('owner@example.test', 'owner');
insert into public.categories (id, slug, name, status) values ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active');
insert into public.products (id, sku, slug, name, category_id, status)
values ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'One', '00000000-0000-0000-0000-00000000c001', 'draft'),
       ('00000000-0000-0000-0000-00000000d002', 'T-2', 't-2', 'Two', '00000000-0000-0000-0000-00000000c001', 'draft');

-- Anonymous visitors can't change the site.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.sync_product('00000000-0000-0000-0000-00000000d001') $$, '42501', null,
  'a visitor cannot sync a product');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);
select public.publish_category('00000000-0000-0000-0000-00000000c001');

-- A new product starts hidden; syncing it keeps it off the site.
select public.sync_product('00000000-0000-0000-0000-00000000d001');
select is((select count(*) from public.published_products)::int, 0, 'a hidden product is not on the site');
select is((select status::text from public.products where sku = 'T-1'), 'draft', 'and stays hidden');
select ok((select version = published_version from public.products where sku = 'T-1'), 'with nothing left waiting');

-- Shown: saved visible and synced, it goes live.
select public.save_product('00000000-0000-0000-0000-00000000d001', (select version from public.products where sku = 'T-1'), '{"status":"active","name":"One shown"}');
select public.sync_product('00000000-0000-0000-0000-00000000d001');
select is((select name from public.published_products where product_id = '00000000-0000-0000-0000-00000000d001'), 'One shown',
  'a visible product goes live with its latest save');

-- Edited: the next sync carries the edit straight to the site.
select public.save_product('00000000-0000-0000-0000-00000000d001', (select version from public.products where sku = 'T-1'), '{"name":"One edited"}');
select public.sync_product('00000000-0000-0000-0000-00000000d001');
select is((select name from public.published_products where product_id = '00000000-0000-0000-0000-00000000d001'), 'One edited',
  'an edit goes live on the next sync');

-- Renamed address, then hidden: the old address keeps its redirect row.
select public.save_product('00000000-0000-0000-0000-00000000d001', (select version from public.products where sku = 'T-1'), '{"slug":"t-1-new"}');
select public.sync_product('00000000-0000-0000-0000-00000000d001');
select is((select count(*) from public.redirects where from_slug = 't-1')::int, 1, 'a renamed address redirects');
select public.save_product('00000000-0000-0000-0000-00000000d001', (select version from public.products where sku = 'T-1'), '{"status":"draft"}');
select public.sync_product('00000000-0000-0000-0000-00000000d001');
select is((select count(*) from public.published_products where product_id = '00000000-0000-0000-0000-00000000d001')::int, 0,
  'hiding a visible product takes it off the site');
select is((select count(*) from public.redirects where from_slug = 't-1')::int, 1, 'its redirects are kept for when it returns');

-- Deleting: only what has never been on the site.
select throws_ok($$ select public.delete_draft_product('00000000-0000-0000-0000-00000000d001') $$, 'PT409', null,
  'a product that has been on the site cannot be deleted, even hidden');
select public.sync_product('00000000-0000-0000-0000-00000000d002');
select lives_ok($$ select public.delete_draft_product('00000000-0000-0000-0000-00000000d002') $$,
  'a product that was never on the site can be deleted');
select is((select count(*) from public.products where sku = 'T-2')::int, 0, 'and is gone');

-- Shown again: back on the site under its new address.
select public.save_product('00000000-0000-0000-0000-00000000d001', (select version from public.products where sku = 'T-1'), '{"status":"active"}');
select public.sync_product('00000000-0000-0000-0000-00000000d001');
select is((select slug from public.published_products where product_id = '00000000-0000-0000-0000-00000000d001'), 't-1-new',
  'showing it again puts it back under its current address');

-- A product is visible or hidden, nothing else.
reset role;
select throws_ok($$ update public.products set status = 'discontinued' where sku = 'T-1' $$, '23514', null,
  'a product cannot be discontinued any more');
select has_table('public', 'discontinued_products_2026_10', 'which products were discontinued is kept on record');

select * from finish();
rollback;
