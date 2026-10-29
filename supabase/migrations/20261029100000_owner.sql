-- The staff list belongs to the owner.
--
-- Everyone else on the list edits the catalogue as before, but only the
-- owner sees who can sign in and adds or removes anyone. `staff.role` was
-- made for this day: until now every row was an 'editor'.

alter table public.staff
  add constraint staff_role_known check (role in ('editor', 'owner'));

-- The first member on the list is the one the seed added: the owner. Run
-- once, and only if nobody is the owner yet, so re-running changes nothing.
update public.staff set role = 'owner'
 where email = (select s.email from public.staff s order by s.created_at, s.email limit 1)
   and not exists (select 1 from public.staff where role = 'owner');

-- Is the signed-in user the owner? Security definer for the same reason as
-- is_staff: it reads `staff` without the policies on `staff` calling back in.
create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff s
    where s.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and s.role = 'owner'
  );
$$;

revoke execute on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

drop policy "staff read staff"   on public.staff;
drop policy "staff add staff"    on public.staff;
drop policy "staff remove staff" on public.staff;
drop policy "staff read sign-ins" on public.sign_in_log;
drop policy "staff read reserved" on public.reserved_addresses;

create policy "owner reads staff"    on public.staff for select to authenticated using (public.is_owner());
create policy "owner adds staff"     on public.staff for insert to authenticated with check (public.is_owner());
create policy "owner removes staff"  on public.staff for delete to authenticated using (public.is_owner());
create policy "owner reads sign-ins" on public.sign_in_log for select to authenticated using (public.is_owner());
create policy "owner reads reserved" on public.reserved_addresses for select to authenticated using (public.is_owner());

-- The list can never be left without an owner: the owner's own row stays.
-- A new owner is made in SQL, deliberately, never from the dashboard.
create or replace function public.guard_last_staff() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.staff) <= 1 then
    raise exception 'The last staff member cannot be removed.'
      using errcode = 'check_violation';
  end if;
  if old.role = 'owner'
     and not exists (select 1 from public.staff s where s.role = 'owner' and s.email <> old.email) then
    raise exception 'The owner cannot be removed.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

-- Added from the dashboard, a member is always an editor.
create or replace function public.guard_staff_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  if exists (select 1 from public.reserved_addresses r where r.email = new.email) then
    raise exception 'The address % is published on the site and cannot be a staff sign-in.', new.email
      using errcode = 'check_violation';
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    new.role := 'editor';
  end if;
  new.invited_by := coalesce(new.invited_by, auth.jwt() ->> 'email');
  return new;
end;
$$;
