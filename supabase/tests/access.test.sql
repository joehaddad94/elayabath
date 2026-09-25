-- Proves the access rules hold at the database, the layer that actually
-- enforces them. Run with `npx supabase test db` (part of `npm run check:db`).
--
-- Each block switches identity the way PostgREST does for a real request:
-- the role, plus the JWT claims that auth.jwt() reads.

begin;
select plan(19);

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


-- ── fixtures, as the table owner ───────────────────────────────────────────

insert into public.reserved_addresses (email) values ('info@example.test');
insert into public.staff (email) values ('owner@example.test');

insert into public.categories (id, slug, name, status)
values ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active');

insert into public.products (id, sku, slug, name, category_id, status)
values ('00000000-0000-0000-0000-00000000d001', 'T-1', 't-1', 'Draft basin',
        '00000000-0000-0000-0000-00000000c001', 'draft');

insert into public.published_products
  (product_id, slug, sku, name, category_slug, status, snapshot)
values ('00000000-0000-0000-0000-00000000d001', 't-1', 'T-1', 'Draft basin',
        'basins', 'active', '{}');

-- ── an anonymous visitor ───────────────────────────────────────────────────

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.products)::int, 0,
  'anon cannot read working products (drafts)');
select is((select count(*) from public.published_products)::int, 1,
  'anon can read the published read model');
select is((select count(*) from public.staff)::int, 0,
  'anon cannot read the staff list');
select throws_ok(
  $$ insert into public.products (sku, slug, name, category_id)
     values ('X', 'x', 'X', '00000000-0000-0000-0000-00000000c001') $$,
  '42501', null, 'anon cannot write products');
select throws_ok(
  $$ insert into public.published_products (product_id, slug, sku, name, category_slug, status, snapshot)
     values (gen_random_uuid(), 'y', 'Y', 'Y', 'basins', 'active', '{}') $$,
  '42501', null, 'anon cannot write the read model');
select throws_ok(
  $$ insert into public.staff (email) values ('intruder@example.test') $$,
  '42501', null, 'anon cannot add staff');

-- ── a signed-in user who is not staff ──────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","email":"stranger@example.test"}', true);

select is(public.is_staff(), false, 'a stranger is not staff');
select is((select count(*) from public.products)::int, 0,
  'a signed-in stranger cannot read drafts');
select throws_ok(
  $$ insert into public.products (sku, slug, name, category_id)
     values ('X', 'x', 'X', '00000000-0000-0000-0000-00000000c001') $$,
  '42501', null, 'a signed-in stranger cannot write products');
select throws_ok(
  $$ insert into public.staff (email) values ('stranger@example.test') $$,
  '42501', null, 'a stranger cannot add themselves to staff');

-- ── a staff member ─────────────────────────────────────────────────────────

select set_config('request.jwt.claims',
  '{"role":"authenticated","email":"owner@example.test"}', true);

select is(public.is_staff(), true, 'a listed address is staff');
select is((select count(*) from public.products)::int, 1,
  'staff can read drafts');
select lives_ok(
  $$ update public.products set name = 'Renamed' where sku = 'T-1' $$,
  'staff can edit a product');
select is((select version from public.products where sku = 'T-1'), 2,
  'saving bumps the version');
select is((select updated_by from public.products where sku = 'T-1'), 'owner@example.test',
  'saving records who saved');
select throws_ok(
  $$ insert into public.staff (email) values ('info@example.test') $$,
  '23514', null, 'an address published on the site cannot join staff');
select throws_ok(
  $$ delete from public.staff where email = 'owner@example.test' $$,
  '23514', null, 'the last staff member cannot be removed');

-- ── the sign-up hook ───────────────────────────────────────────────────────

reset role;

select is(
  public.hook_before_user_created('{"user":{"email":"Owner@Example.test"}}'::jsonb),
  '{}'::jsonb,
  'the hook admits a listed address, whatever its case');
select is(
  public.hook_before_user_created('{"user":{"email":"stranger@example.test"}}'::jsonb) -> 'error' ->> 'http_code',
  '403',
  'the hook refuses an address that is not on the list');

select * from finish();
rollback;
