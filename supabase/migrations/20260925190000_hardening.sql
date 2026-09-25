-- The dashboard's views are for staff. Supabase grants every new object to
-- the anonymous role by default; row-level security already left these
-- empty for anyone else, and this removes the access outright.
revoke all on public.admin_products, public.finish_usage, public.category_counts,
              public.type_counts, public.duplicate_finish_codes
  from anon;
