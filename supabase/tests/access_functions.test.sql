-- Every dashboard function and view refuses anyone who is not staff: an
-- anonymous visitor, and a signed-in account that is not (or no longer) on
-- the staff list. Run with `npx supabase test db`.

begin;
select plan(31);

delete from public.import_jobs;
delete from public.mapping_presets;
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
insert into public.categories (id, slug, name, status) values ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active');
insert into public.products (id, sku, slug, name, category_id, status)
values ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'One', '00000000-0000-0000-0000-00000000c001', 'draft');
insert into public.finishes (id, slug, code, name, family) values ('00000000-0000-0000-0000-00000000f001', 'white', 'T01', 'White', 'ceramic');
insert into public.import_jobs (id, entity, file_path, file_name, status)
values ('00000000-0000-0000-0000-0000000000a1', 'products', 'jobs/x/a.csv', 'a.csv', 'staged');
insert into public.mapping_presets (entity, name, mapping) values ('products', 'Theirs', '{}');

-- ── anonymous ──────────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select public.save_product('00000000-0000-0000-0000-00000000d001', 1, '{}') $$, '42501', null, 'anon: save_product');
select throws_ok($$ select public.delete_draft_product('00000000-0000-0000-0000-00000000d001') $$, '42501', null, 'anon: delete_draft_product');
select throws_ok($$ select public.restore_product('00000000-0000-0000-0000-00000000d001', 1, 1) $$, '42501', null, 'anon: restore_product');
select throws_ok($$ select public.save_category('00000000-0000-0000-0000-00000000c001', 1, '{}') $$, '42501', null, 'anon: save_category');
select throws_ok($$ select public.set_product_order('00000000-0000-0000-0000-00000000c001', '{}') $$, '42501', null, 'anon: set_product_order');
select throws_ok($$ select public.set_category_order('{}') $$, '42501', null, 'anon: set_category_order');
select throws_ok($$ select public.set_featured_order('{}') $$, '42501', null, 'anon: set_featured_order');
select throws_ok($$ select public.apply_import('00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'anon: apply_import');
select throws_ok($$ select public.discard_import('00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'anon: discard_import');
select throws_ok($$ select public.delete_unused_finish('00000000-0000-0000-0000-00000000f001') $$, '42501', null, 'anon: delete_unused_finish');
select throws_ok($$ select * from public.storage_usage() $$, '42501', null, 'anon: storage_usage');
select throws_ok($$ select * from public.unused_media() $$, '42501', null, 'anon: unused_media');
select throws_ok($$ select * from public.media_in_use() $$, '42501', null, 'anon: media_in_use');
select throws_ok($$ select * from public.admin_products $$, '42501', null, 'anon: admin_products');
select is((select count(*) from public.import_rows)::int + (select count(*) from public.import_jobs)::int, 0, 'anon: imports are invisible');

-- ── signed in, not on the staff list ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"former@example.test"}', true);

select throws_ok($$ select public.set_product_order('00000000-0000-0000-0000-00000000c001', '{}') $$, '42501', null, 'non-staff: set_product_order');
select throws_ok($$ select public.set_category_order('{}') $$, '42501', null, 'non-staff: set_category_order');
select throws_ok($$ select public.set_featured_order('{}') $$, '42501', null, 'non-staff: set_featured_order');
select throws_ok($$ select * from public.storage_usage() $$, '42501', null, 'non-staff: storage_usage');
select throws_ok($$ select * from public.unused_media() $$, '42501', null, 'non-staff: unused_media');
select throws_ok($$ select public.publish_product('00000000-0000-0000-0000-00000000d001') $$, '42501', null, 'non-staff: publish_product');
select is(public.product_snapshot('00000000-0000-0000-0000-00000000d001'), null, 'non-staff: product_snapshot reads nothing');
select throws_ok($$ select public.apply_import('00000000-0000-0000-0000-0000000000a1') $$, 'P0002', null, 'non-staff: apply_import finds no job');
select throws_ok($$ select public.discard_import('00000000-0000-0000-0000-0000000000a1') $$, 'P0002', null, 'non-staff: discard_import finds no job');
select throws_ok($$ select public.save_category('00000000-0000-0000-0000-00000000c001', 1, '{"name":"X"}') $$, 'P0002', null, 'non-staff: save_category finds no category');
select throws_ok($$ select public.delete_unused_finish('00000000-0000-0000-0000-00000000f001') $$, 'P0002', null, 'non-staff: delete_unused_finish finds no finish');
select is((select count(*) from public.admin_products)::int, 0, 'non-staff: admin_products is empty');
select is((select count(*) from public.import_jobs)::int + (select count(*) from public.mapping_presets)::int, 0, 'non-staff: imports and presets are invisible');
select is((select count(*) from public.finish_usage)::int + (select count(*) from public.category_counts)::int + (select count(*) from public.type_counts)::int, 0,
  'non-staff: the count views are empty');
select throws_ok($$ insert into public.mapping_presets (entity, name, mapping) values ('products', 'Mine', '{}') $$, '42501', null,
  'non-staff: cannot save a preset');

-- The same account, once on the list, sees it all.
reset role;
insert into public.staff (email) values ('former@example.test');
set local role authenticated;
select is((select count(*) from public.admin_products)::int, 1, 'staff: admin_products shows the working copy');

select * from finish();
rollback;
