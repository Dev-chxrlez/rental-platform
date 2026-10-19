begin;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  method text not null check (method in ('gcash', 'bank')),
  account_name text not null check (char_length(btrim(account_name)) between 2 and 120),
  account_reference text check (account_reference is null or char_length(btrim(account_reference)) between 2 and 120),
  qr_path text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, method),
  constraint payment_method_has_instructions check (account_reference is not null or qr_path is not null),
  constraint payment_qr_belongs_to_owner check (
    qr_path is null or (
      qr_path like owner_id::text || '/%'
      and lower(qr_path) ~ '\.(jpg|jpeg|png|webp)$'
    )
  )
);

alter table public.payment_methods enable row level security;

create policy "Owners can view their payment methods"
  on public.payment_methods for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Accepted renters can view owner payment methods"
  on public.payment_methods for select to authenticated
  using (
    is_enabled = true
    and exists (
      select 1 from public.rental_requests
      where rental_requests.owner_id = payment_methods.owner_id
        and rental_requests.renter_id = (select auth.uid())
        and rental_requests.status in ('accepted', 'handed_over', 'returned')
    )
  );

create policy "Owners can create payment methods"
  on public.payment_methods for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and not public.current_user_is_admin()
  );

create policy "Owners can update payment methods"
  on public.payment_methods for update to authenticated
  using ((select auth.uid()) = owner_id and not public.current_user_is_admin())
  with check ((select auth.uid()) = owner_id and not public.current_user_is_admin());

create policy "Owners can delete payment methods"
  on public.payment_methods for delete to authenticated
  using ((select auth.uid()) = owner_id and not public.current_user_is_admin());

revoke all on table public.payment_methods from anon, authenticated;
grant select on table public.payment_methods to authenticated;
grant insert (method, account_name, account_reference, qr_path, is_enabled) on table public.payment_methods to authenticated;
grant update (account_name, account_reference, qr_path, is_enabled) on table public.payment_methods to authenticated;
grant delete on table public.payment_methods to authenticated;

create or replace function public.set_payment_method_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_payment_method_updated_at
before update on public.payment_methods
for each row execute function public.set_payment_method_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-qr-codes', 'payment-qr-codes', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners can view their payment QR codes"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-qr-codes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Accepted renters can view payment QR codes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-qr-codes'
    and exists (
      select 1 from public.rental_requests
      where rental_requests.owner_id::text = (storage.foldername(name))[1]
        and rental_requests.renter_id = (select auth.uid())
        and rental_requests.status in ('accepted', 'handed_over', 'returned')
    )
  );

create policy "Owners can upload payment QR codes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-qr-codes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
    and not public.current_user_is_admin()
  );

create policy "Owners can delete payment QR codes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-qr-codes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.current_user_is_admin()
  );

commit;
