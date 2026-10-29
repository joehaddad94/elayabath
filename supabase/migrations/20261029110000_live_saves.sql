-- Saving puts a change live.
--
-- There is no separate Publish step any more: the dashboard saves the
-- working copy and then calls sync_product, which makes the site match it.
-- A product is either visible (status 'active') or hidden (status 'draft',
-- shown as "Hidden" on the dashboard). Hidden means off the site entirely:
-- no page, no listing, no search result.
--
-- publish_product is unchanged and still what scripts (the seed) call; the
-- dashboard goes through sync_product, which never makes a hidden product
-- visible by accident.

create function public.sync_product(p_id uuid, p_note text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  p public.products%rowtype;
begin
  if not public.can_publish() then
    raise exception 'Only staff can change the site.' using errcode = '42501';
  end if;

  select * into p from public.products where id = p_id for update;
  if not found then
    raise exception 'No product %.', p_id using errcode = 'no_data_found';
  end if;

  if p.status <> 'draft' then
    return public.publish_product(p_id, p_note);
  end if;

  -- Hidden: take it off the site. Its redirects stay, pointing at nothing
  -- until it is shown again, when they work again.
  delete from public.published_products where product_id = p_id;
  -- Bookkeeping only (the version trigger ignores it): the site matches the
  -- working copy, so nothing is waiting.
  update public.products
     set published_version = p.version, import_job_id = null
   where id = p_id;
  return p.version;
end;
$$;

revoke execute on function public.sync_product(uuid, text) from public, anon;
grant execute on function public.sync_product(uuid, text) to authenticated, service_role;

-- A product can be deleted while it has never been on the site: nothing
-- links to it. Once it has been visible it can only be hidden, so its
-- history and old links' redirects survive. (Before, "never published" was
-- the test; hidden products are now synced, so the test is the history.)
create or replace function public.delete_draft_product(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.products p
   where p.id = p_id
     and not exists (select 1 from public.published_products pp where pp.product_id = p_id)
     and not exists (select 1 from public.revisions r where r.entity_type = 'product' and r.entity_id = p_id);
  if not found then
    raise exception 'Only a product that has never been on the site can be deleted. Hide it instead.'
      using errcode = 'PT409';
  end if;
end;
$$;
