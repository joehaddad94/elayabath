-- The products grid's data: one row per product in the working tables, with
-- everything the grid shows, sorts or filters on already computed, so the
-- server can page it without the browser holding the table.
--
-- security_invoker, so row-level security on the underlying tables applies:
-- only staff see anything through it.

create view public.admin_products
with (security_invoker = true) as
select
  p.id,
  p.sku,
  p.slug,
  p.name,
  p.category_id,
  c.slug                                   as category_slug,
  c.name                                   as category_name,
  c.position                               as category_position,
  p.type_id,
  t.name                                   as type_name,
  p.status,
  p.featured,
  p.position,
  p.dimensions,
  p.datasheet_path is not null             as has_datasheet,
  img.path                                 as image_path,
  coalesce(fin.n, 0)::int                  as finish_count,
  -- Six checks, the same six the product editor shows. Never a gate: the
  -- plan's rule is warn, never block.
  (
    (img.path is not null)::int
    + (p.type_id is not null)::int
    + (coalesce(p.dimensions, '') <> '')::int
    + (coalesce(p.description, '') <> '')::int
    + (p.datasheet_path is not null)::int
    + (coalesce(fin.n, 0) > 0)::int
  )                                        as completeness,
  array_remove(array[
    case when img.path is null then 'photograph' end,
    case when p.type_id is null then 'product type' end,
    case when coalesce(p.dimensions, '') = '' then 'dimensions' end,
    case when coalesce(p.description, '') = '' then 'description' end,
    case when p.datasheet_path is null then 'data sheet' end,
    case when coalesce(fin.n, 0) = 0 then 'finishes' end
  ], null)                                 as missing,
  -- Unpublished changes: never published, or edited since it was.
  (p.published_version is null or p.version <> p.published_version) as has_changes,
  p.published_version,
  p.version,
  p.import_job_id,
  p.updated_at,
  p.updated_by
from public.products p
join public.categories c on c.id = p.category_id
left join public.product_types t on t.id = p.type_id
left join lateral (
  select i.path from public.product_images i
  where i.product_id = p.id
  order by i.position, i.created_at
  limit 1
) img on true
left join lateral (
  select count(*) as n from public.product_finishes pf where pf.product_id = p.id
) fin on true;

grant select on public.admin_products to authenticated;
