-- Site content: anyone reads it, only staff change it, and a save reports what
-- it replaced so it can be undone.

begin;
select plan(12);

delete from public.site_content;
alter table public.staff disable trigger staff_guard_last;
delete from public.staff;
alter table public.staff enable trigger staff_guard_last;
insert into public.staff (email, role) values ('owner@example.test', 'owner');
insert into public.site_content (key, value) values ('home.lede', '"Before"');

-- A visitor reads it and cannot change it.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select value #>> '{}' from public.site_content where key = 'home.lede'), 'Before', 'a visitor reads site content');
select throws_ok($$ select public.save_site_content('{"home.lede":"Hacked"}') $$, '42501', null,
  'a visitor cannot save site content');

-- Someone signed in but not on the staff list cannot either.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.test"}', true);
select throws_ok($$ select public.save_site_content('{"home.lede":"Hacked"}') $$, '42501', null,
  'a non-staff account cannot save site content');

-- Staff save: set one key, add another, clear a third that never existed.
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.test"}', true);
select is(
  public.save_site_content('{"home.lede":"After","home.quote":"New quote"}', '{home.plateFoot}'),
  '{"home.lede":"Before","home.quote":null,"home.plateFoot":null}'::jsonb,
  'a save returns what each key held before');
select is((select value #>> '{}' from public.site_content where key = 'home.lede'), 'After', 'the edit is saved');
select is((select updated_by from public.site_content where key = 'home.lede'), 'owner@example.test', 'with who saved it');
select is((select count(*) from public.site_content)::int, 2, 'a new key gets a row');

-- Undo: saving the previous values back, nulls as clears.
select public.save_site_content('{"home.lede":"Before"}', '{home.quote,home.plateFoot}');
select is((select value #>> '{}' from public.site_content where key = 'home.lede'), 'Before', 'undo restores a changed key');
select is((select count(*) from public.site_content where key = 'home.quote')::int, 0, 'and clears a key that was new');

-- Keys are names, not free text.
select throws_ok($$ select public.save_site_content('{"Bad Key":"x"}') $$, '23514', null, 'a malformed key is refused');

-- Category tiles: the photo and icon save with the version check.
insert into public.categories (id, slug, name, status, image, icon)
values ('00000000-0000-0000-0000-00000000c001', 'basins', 'Basins', 'active', '/rooms/a.webp', '/icons/a.png');
select public.save_category('00000000-0000-0000-0000-00000000c001',
  (select version from public.categories where slug = 'basins'), '{"image":"categories/x/1.webp"}');
select is((select image || ' ' || icon from public.categories where slug = 'basins'), 'categories/x/1.webp /icons/a.png',
  'save_category changes the photo and leaves the icon');
select throws_ok($$ select public.save_category('00000000-0000-0000-0000-00000000c001', 1, '{"icon":"x.png"}') $$, 'PT409', null,
  'an out-of-date tile save is refused');

select * from finish();
rollback;
