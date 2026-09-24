-- Who can read and write what.
--
-- The staff table decides. Row-level security is the layer that actually
-- enforces it: the proxy and the Server Actions check too, but a bug in
-- either still meets a database that refuses the query.

-- Is the signed-in user on the staff list? Security definer so the check can
-- read `staff` without the policies on `staff` calling back into it.
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke execute on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- ── row-level security on every table ──────────────────────────────────────

alter table public.staff                enable row level security;
alter table public.reserved_addresses   enable row level security;
alter table public.sign_in_log          enable row level security;
alter table public.categories           enable row level security;
alter table public.product_types        enable row level security;
alter table public.finishes             enable row level security;
alter table public.products             enable row level security;
alter table public.product_finishes     enable row level security;
alter table public.product_images       enable row level security;
alter table public.revisions            enable row level security;
alter table public.published_products   enable row level security;
alter table public.published_categories enable row level security;
alter table public.published_finishes   enable row level security;
alter table public.catalogue_meta       enable row level security;
alter table public.redirects            enable row level security;
alter table public.grid_views           enable row level security;
alter table public.import_jobs          enable row level security;
alter table public.import_rows          enable row level security;
alter table public.mapping_presets      enable row level security;

-- ── public: the read model only ────────────────────────────────────────────

create policy "anyone reads published products"   on public.published_products   for select to anon, authenticated using (true);
create policy "anyone reads published categories" on public.published_categories for select to anon, authenticated using (true);
create policy "anyone reads published finishes"   on public.published_finishes   for select to anon, authenticated using (true);
create policy "anyone reads catalogue meta"       on public.catalogue_meta       for select to anon, authenticated using (true);
create policy "anyone reads redirects"            on public.redirects            for select to anon, authenticated using (true);

-- The read model is written only by the publish functions, which run as
-- their owner. No policy grants writes to it directly.

-- ── staff: the working tables ──────────────────────────────────────────────

create policy "staff edit categories"       on public.categories       for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff edit product types"    on public.product_types    for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff edit finishes"         on public.finishes         for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff edit products"         on public.products         for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff edit product finishes" on public.product_finishes for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff edit product images"   on public.product_images   for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff read history"          on public.revisions        for select to authenticated using (public.is_staff());
create policy "staff manage imports"        on public.import_jobs      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage import rows"    on public.import_rows      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage presets"        on public.mapping_presets  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- The staff list itself. Equal rights: any staff member can add or remove
-- anyone, within the guards on the table (no reserved addresses, never the
-- last member). Addresses are identities, so rows are never edited.
create policy "staff read staff"   on public.staff for select to authenticated using (public.is_staff());
create policy "staff add staff"    on public.staff for insert to authenticated with check (public.is_staff());
create policy "staff remove staff" on public.staff for delete to authenticated using (public.is_staff());

create policy "staff read reserved" on public.reserved_addresses for select to authenticated using (public.is_staff());

-- Written only by the direct sign-in action, with the service key.
create policy "staff read sign-ins" on public.sign_in_log for select to authenticated using (public.is_staff());

-- Saved grid views: yours, or ones a colleague shared.
create policy "staff read views" on public.grid_views for select to authenticated
  using (public.is_staff() and (shared or owner = lower(auth.jwt() ->> 'email')));
create policy "staff create views" on public.grid_views for insert to authenticated
  with check (public.is_staff() and owner = lower(auth.jwt() ->> 'email'));
create policy "staff change own views" on public.grid_views for update to authenticated
  using (public.is_staff() and owner = lower(auth.jwt() ->> 'email'))
  with check (public.is_staff() and owner = lower(auth.jwt() ->> 'email'));
create policy "staff delete own views" on public.grid_views for delete to authenticated
  using (public.is_staff() and owner = lower(auth.jwt() ->> 'email'));

-- ── the sign-up hook ───────────────────────────────────────────────────────

-- Supabase Auth runs this before creating any account. Anything not on the
-- staff list is refused, which is what lets invitations be a plain row in
-- `staff`, with no email and no service key involved.
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  requested text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if requested = '' or not exists (select 1 from public.staff s where s.email = requested) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This address is not on the staff list.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
