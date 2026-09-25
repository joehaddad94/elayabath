-- Products per category, counted in the database so the dashboard never
-- pages through every product to count them.
create view public.category_counts
with (security_invoker = true) as
select c.id as category_id,
       count(p.id)::int as products,
       count(p.id) filter (where p.status = 'active')::int as live
  from public.categories c
  left join public.products p on p.category_id = c.id
 group by c.id;

grant select on public.category_counts to authenticated;

-- Products per product type, for the category editor.
create view public.type_counts
with (security_invoker = true) as
select t.id as type_id, t.category_id, count(p.id)::int as products
  from public.product_types t
  left join public.products p on p.type_id = t.id
 group by t.id, t.category_id;

grant select on public.type_counts to authenticated;
