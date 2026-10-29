-- The staff list belongs to the owner: editors edit the catalogue but can
-- neither read nor change who can sign in.

begin;
select plan(12);

alter table public.staff disable trigger staff_guard_last;
delete from public.staff;
alter table public.staff enable trigger staff_guard_last;
delete from public.reserved_addresses;

insert into public.staff (email, role) values ('owner@example.test', 'owner');
insert into public.staff (email) values ('editor@example.test');
insert into public.sign_in_log (email, method) values ('editor@example.test', 'direct');

set local role authenticated;

-- ── an editor ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"role":"authenticated","email":"editor@example.test"}', true);

select is(public.is_staff(), true, 'an editor is staff');
select is(public.is_owner(), false, 'an editor is not the owner');
select is((select count(*) from public.staff)::int, 0, 'an editor cannot read the staff list');
select is((select count(*) from public.sign_in_log)::int, 0, 'an editor cannot read the sign-ins');
select throws_ok(
  $$ insert into public.staff (email) values ('friend@example.test') $$,
  '42501', null, 'an editor cannot add staff');
delete from public.staff where email = 'owner@example.test';
reset role;
select is((select count(*) from public.staff)::int, 2, 'an editor cannot remove anyone');
set local role authenticated;

-- ── the owner ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"role":"authenticated","email":"owner@example.test"}', true);

select is(public.is_owner(), true, 'the owner is the owner');
select is((select count(*) from public.staff)::int, 2, 'the owner reads the staff list');
select lives_ok(
  $$ insert into public.staff (email, role) values ('friend@example.test', 'owner') $$,
  'the owner adds staff');
select is((select role from public.staff where email = 'friend@example.test'), 'editor',
  'a member added from the dashboard is always an editor');
select lives_ok(
  $$ delete from public.staff where email = 'editor@example.test' $$,
  'the owner removes an editor');
select throws_ok(
  $$ delete from public.staff where email = 'owner@example.test' $$,
  '23514', null, 'the owner cannot be removed');

select * from finish();
rollback;
