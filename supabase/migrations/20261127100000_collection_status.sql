-- The Collections screen's "on the site" now reads what the site reads.
--
-- `live` used to count products set to visible in the working copy. The
-- site shows a collection only when one of its products is live in
-- `published_products` and its category is live in `published_categories`
-- (see collection_cards), so a collection in a hidden category showed as on
-- the site when it wasn't. `live` now counts live products, and
-- `category_live` says whether the category is on the site.
--
-- `first_position` is where its first product sits in the category, the
-- order the site lists collections in, so the dashboard can use the same.

create or replace view public.collection_counts
with (security_invoker = true) as
select col.id as collection_id,
       (select count(*) from public.products p where p.collection_id = col.id)::int as products,
       (select count(*) from public.published_products pp
         where pp.collection_id = col.id and pp.status = 'active')::int as live,
       exists (select 1 from public.published_categories pc
                where pc.category_id = col.category_id and pc.status = 'active') as category_live,
       (select min(p.position) from public.products p where p.collection_id = col.id) as first_position
  from public.collections col;

revoke all on public.collection_counts from anon;
grant select on public.collection_counts to authenticated;
