-- "Unpublished changes" means a real change, and republishing adds no
-- duplicate history. Run with `npx supabase test db`.

begin;
select plan(5);

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
insert into public.products (id, sku, slug, name, category_id, dimensions, status)
values ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'One', '00000000-0000-0000-0000-00000000c001', '100 mm', 'draft');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);
select public.publish_category('00000000-0000-0000-0000-00000000c001');
select public.publish_product('00000000-0000-0000-0000-00000000d001');

-- An edit, then an edit back: the product ends up exactly as it is live.
select public.save_product('00000000-0000-0000-0000-00000000d001', 1, '{"dimensions":"200 mm"}');
select ok((select version <> published_version from public.products where sku = 'T-1'), 'a real edit is an unpublished change');
select public.save_product('00000000-0000-0000-0000-00000000d001', 2, '{"dimensions":"100 mm"}');
select ok((select version = published_version from public.products where sku = 'T-1'),
  'editing it back to the live version leaves nothing to publish');

-- A save that changes nothing at all.
select public.save_product('00000000-0000-0000-0000-00000000d001', 3, '{"dimensions":"100 mm"}');
select ok((select version = published_version from public.products where sku = 'T-1'), 'so does a save with no change');

-- Publishing the same version twice.
select public.publish_product('00000000-0000-0000-0000-00000000d001');
select public.publish_product('00000000-0000-0000-0000-00000000d001');
select is((select count(*) from public.revisions where entity_type = 'product' and entity_id = '00000000-0000-0000-0000-00000000d001' and version = 4)::int, 1,
  'publishing a version twice records it once');
select public.publish_category('00000000-0000-0000-0000-00000000c001');
select is((select count(*) from public.revisions where entity_type = 'category')::int, 1, 'likewise for a category');

select * from finish();
rollback;
