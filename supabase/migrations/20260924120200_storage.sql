-- Buckets and who may write to them.
--
-- Three are public: anything published is meant to be seen, and next/image
-- fetches from them directly. `imports` is private: an uploaded spreadsheet
-- is staff working material.
--
-- The database stores paths inside these buckets, never full URLs, so the
-- host can change (a larger plan, Elaya's own account) with no data rewrite.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-media', 'product-media', true,  10485760, array['image/webp', 'image/jpeg', 'image/png']),
  ('swatches',      'swatches',      true,   2097152, array['image/webp', 'image/jpeg', 'image/png']),
  ('datasheets',    'datasheets',    true,  52428800, array['application/pdf']),
  ('imports',       'imports',       false, 52428800, array[
    'text/csv',
    'text/tab-separated-values',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ])
on conflict (id) do nothing;

create policy "staff upload media" on storage.objects for insert to authenticated
  with check (bucket_id in ('product-media', 'swatches', 'datasheets', 'imports') and public.is_staff());

create policy "staff replace media" on storage.objects for update to authenticated
  using (bucket_id in ('product-media', 'swatches', 'datasheets', 'imports') and public.is_staff())
  with check (bucket_id in ('product-media', 'swatches', 'datasheets', 'imports') and public.is_staff());

create policy "staff remove media" on storage.objects for delete to authenticated
  using (bucket_id in ('product-media', 'swatches', 'datasheets', 'imports') and public.is_staff());

-- Public buckets are readable through their public URLs without a policy.
-- Listing objects, and reading the private imports bucket, is staff only.
create policy "staff list media" on storage.objects for select to authenticated
  using (bucket_id in ('product-media', 'swatches', 'datasheets', 'imports') and public.is_staff());
