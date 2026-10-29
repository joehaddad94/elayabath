-- A product is visible or hidden; "discontinued" goes.
--
-- Discontinued products kept their page but left the listings. They become
-- hidden: off the site entirely, like any hidden product. Their rows, photos,
-- finishes, history and old-address redirects all stay; only the status
-- changes. Which products moved is recorded below, so the change can be
-- looked up or reversed product by product.
--
-- Categories keep using 'discontinued' to mean hidden; the enum is shared,
-- so it stays, and products are held to the two values by a check.

create table public.discontinued_products_2026_10 (
  product_id uuid primary key references public.products (id) on delete cascade,
  sku        text not null,
  slug       text not null,
  was_on_site boolean not null,
  moved_at   timestamptz not null default now()
);
comment on table public.discontinued_products_2026_10 is
  'Products that were discontinued on 2026-10-29, when the status was dropped and they became hidden.';
-- Reference only: no policies, so only the service role reads it.
alter table public.discontinued_products_2026_10 enable row level security;

insert into public.discontinued_products_2026_10 (product_id, sku, slug, was_on_site)
select p.id, p.sku, p.slug, exists (select 1 from public.published_products pp where pp.product_id = p.id)
  from public.products p
 where p.status = 'discontinued';

-- Off the site. Their redirects stay, pointing at nothing until a product
-- is shown again.
delete from public.published_products pp
 using public.discontinued_products_2026_10 d
 where pp.product_id = d.product_id;

-- Hidden (a new version, by the editing trigger), then nothing left
-- waiting: the site matches the working copy, which is off the site.
update public.products p
   set status = 'draft'
  from public.discontinued_products_2026_10 d
 where p.id = d.product_id;
update public.products p
   set published_version = p.version, import_job_id = null
  from public.discontinued_products_2026_10 d
 where p.id = d.product_id;

alter table public.products
  add constraint products_visible_or_hidden check (status in ('draft', 'active'));
