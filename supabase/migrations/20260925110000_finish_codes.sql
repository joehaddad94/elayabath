-- Finish codes are not unique in the client's data, so the database cannot
-- insist that they are.
--
-- Found by the full-catalogue seed, 2026-09-25:
--   P08   Polished Copper (67 products) and Polished Rose Gold (9): two
--         different finishes sharing one code. A quote for "P08" cannot tell
--         them apart. This one is a real problem for the client to resolve.
--   RT10  Maize Yellow, entered twice under two slugs, one with a typo.
--   RT13  Blackish Green, entered twice, once with a "-2" suffix.
--
-- None of these is merged or renamed here: the plan's rule is that known data
-- problems are shown to staff to decide, never fixed silently. The slug stays
-- the unique identity; the code keeps an index for lookups, and
-- public.duplicate_finish_codes lets the dashboard flag every collision.

alter table public.finishes drop constraint finishes_code_key;
create index finishes_code on public.finishes (code);

create view public.duplicate_finish_codes
with (security_invoker = true) as
  select f.code, array_agg(f.slug order by f.slug) as slugs, count(*) as finishes
  from public.finishes f
  group by f.code
  having count(*) > 1;

grant select on public.duplicate_finish_codes to authenticated;
