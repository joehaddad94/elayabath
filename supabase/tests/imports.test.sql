-- Applying and discarding an import. Run with `npx supabase test db`.

begin;
select plan(10);

delete from public.import_jobs;
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
insert into public.products (id, sku, slug, name, category_id, dimensions, status) values
  ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'One', '00000000-0000-0000-0000-00000000c001', '100 mm', 'draft'),
  ('00000000-0000-0000-0000-00000000d002', 'T-2', 't-2', 'Two', '00000000-0000-0000-0000-00000000c001', '200 mm', 'draft');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);
select public.publish_category('00000000-0000-0000-0000-00000000c001');
select public.publish_product(id) from public.products;

insert into public.import_jobs (id, entity, file_path, file_name, status)
values ('00000000-0000-0000-0000-0000000000a1', 'products', 'jobs/x/a.csv', 'a.csv', 'staged');
insert into public.import_rows (job_id, row_number, raw, outcome, parsed, base_version) values
  ('00000000-0000-0000-0000-0000000000a1', 2, '[]', 'changed',
   '{"id":"00000000-0000-0000-0000-00000000d001","fields":{"dimensions":"111 mm"}}', 1),
  -- staged against version 1, but T-2 moves on before the import is applied
  ('00000000-0000-0000-0000-0000000000a1', 3, '[]', 'changed',
   '{"id":"00000000-0000-0000-0000-00000000d002","fields":{"dimensions":"222 mm"}}', 1),
  ('00000000-0000-0000-0000-0000000000a1', 4, '[]', 'new',
   '{"id":null,"fields":{"sku":"T-3","slug":"t-3","name":"Three","category_id":"00000000-0000-0000-0000-00000000c001"}}', null),
  ('00000000-0000-0000-0000-0000000000a1', 5, '[]', 'unchanged', null, null);
update public.products set name = 'Two, edited' where sku = 'T-2';

select is(public.apply_import('00000000-0000-0000-0000-0000000000a1', 200) ->> 'applied', '2',
  'the changed and the new rows are applied');
select is((select dimensions from public.products where sku = 'T-1'), '111 mm', 'only the mapped field changes');
select is((select import_job_id from public.products where sku = 'T-1'), '00000000-0000-0000-0000-0000000000a1'::uuid,
  'and the product is tagged with the import');
select is((select dimensions from public.products where sku = 'T-2'), '200 mm',
  'a row edited after the check is not overwritten');
select is((select outcome from public.import_rows where row_number = 3), 'error', 'it is marked as an error instead');
select ok((select status = 'draft' and import_job_id is not null from public.products where sku = 'T-3'),
  'a new row becomes a tagged draft');
select is((select status from public.import_jobs), 'applied', 'the job is applied once nothing is left');

select public.discard_import('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.products where sku = 'T-3')::int, 0, 'discarding deletes what it created');
select is((select dimensions from public.products where sku = 'T-1'), '100 mm', 'and puts back what it changed');
select ok((select version = published_version and import_job_id is null from public.products where sku = 'T-1'),
  'leaving it matching the live version, untagged');

select * from finish();
rollback;
