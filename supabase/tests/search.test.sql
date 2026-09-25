-- The cases that used to test src/lib/search.ts in the browser, against
-- public.search_catalogue(), which replaces it. Same fixtures, same rules.

begin;
select plan(11);

insert into public.categories (id, slug, name) values
  ('00000000-0000-0000-0000-00000000c101', 'washbasins', 'Washbasins'),
  ('00000000-0000-0000-0000-00000000c102', 'toilets', 'Toilets'),
  ('00000000-0000-0000-0000-00000000c103', 'tapware', 'Tapware');

insert into public.products (id, sku, slug, name, category_id) values
  ('00000000-0000-0000-0000-0000000000b1', 'E02-SW40034', 'e02-sw40034', 'ANELLO', '00000000-0000-0000-0000-00000000c101'),
  ('00000000-0000-0000-0000-0000000000b2', 'E01-SW10114', 'e01-sw10114', 'ARCO',   '00000000-0000-0000-0000-00000000c101'),
  ('00000000-0000-0000-0000-0000000000b3', 'E06-SW10413', 'e06-sw10413', 'AXE C',  '00000000-0000-0000-0000-00000000c102'),
  ('00000000-0000-0000-0000-0000000000b4', 'E05-SF20073', 'e05-sf20073', 'ARIA',   '00000000-0000-0000-0000-00000000c103'),
  ('00000000-0000-0000-0000-0000000000b5', 'E09-XX00001', 'e09-xx00001', 'HIDDEN', '00000000-0000-0000-0000-00000000c101');

insert into public.published_products (product_id, slug, sku, name, category_slug, status, snapshot) values
  ('00000000-0000-0000-0000-0000000000b1', 'e02-sw40034', 'E02-SW40034', 'ANELLO', 'washbasins', 'active',
   '{"slug":"e02-sw40034","name":"ANELLO","sku":"E02-SW40034","type":{"name":"Above Counter Washbasin"},"categoryName":"Washbasins"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'e01-sw10114', 'E01-SW10114', 'ARCO', 'washbasins', 'active',
   '{"slug":"e01-sw10114","name":"ARCO","sku":"E01-SW10114","type":{"name":"Above Counter Washbasin"},"categoryName":"Washbasins"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'e06-sw10413', 'E06-SW10413', 'AXE C', 'toilets', 'active',
   '{"slug":"e06-sw10413","name":"AXE C","sku":"E06-SW10413","type":{"name":"Wall Hung WC"},"categoryName":"Toilets"}'),
  ('00000000-0000-0000-0000-0000000000b4', 'e05-sf20073', 'E05-SF20073', 'ARIA', 'tapware', 'active',
   '{"slug":"e05-sf20073","name":"ARIA","sku":"E05-SF20073","type":{"name":"Basin mixer"},"categoryName":"Tapware"}'),
  -- discontinued: its page still works, but it no longer turns up in search
  ('00000000-0000-0000-0000-0000000000b5', 'e09-xx00001', 'E09-XX00001', 'HIDDEN', 'washbasins', 'discontinued',
   '{"slug":"e09-xx00001","name":"HIDDEN","sku":"E09-XX00001","type":{"name":"Above Counter Washbasin"},"categoryName":"Washbasins"}');

create function pg_temp.names(q text, lim int default 40) returns text language sql as $$
  select coalesce(string_agg(h ->> 'n', ',' order by ord), '')
  from jsonb_array_elements(public.search_catalogue(q, lim)) with ordinality as x(h, ord);
$$;

select is(split_part(pg_temp.names('E01-SW10114'), ',', 1), 'ARCO', 'an exact item code outranks everything');
select is(split_part(pg_temp.names('e01 sw10114'), ',', 1), 'ARCO', 'an item code matches with its punctuation stripped');
select is(pg_temp.names('tapware'), 'ARIA', 'matches on category');
select is(pg_temp.names('wall hung'), 'AXE C', 'matches on type');
select is(jsonb_array_length(public.search_catalogue('washbasin')), 2, 'a single term matches broadly');
select is(jsonb_array_length(public.search_catalogue('washbasin arco')), 1, 'every term must match, so adding a word narrows');
select is(public.search_catalogue(''), '[]'::jsonb, 'an empty query returns nothing, not everything');
select is(public.search_catalogue('   '), '[]'::jsonb, 'a whitespace query returns nothing');
select is(public.search_catalogue('E01-SW99999'), '[]'::jsonb, 'no match is empty rather than near misses');
select is(jsonb_array_length(public.search_catalogue('washbasins', 1)), 1, 'respects the result limit');
select is(public.search_catalogue('anello') -> 0 ->> 'k', 'E02-SW40034', 'is case insensitive');

select * from finish();
rollback;
