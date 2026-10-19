begin;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  category text not null check (category in ('equipment', 'vehicles', 'spaces', 'technology', 'other')),
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  daily_price numeric(10, 2) not null check (daily_price > 0 and daily_price <= 99999999.99),
  replacement_value numeric(12, 2) not null check (replacement_value > 0 and replacement_value <= 9999999999.99),
  condition text not null check (condition in ('new', 'like_new', 'good', 'fair')),
  image_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint listing_image_belongs_to_owner check (
    image_path like owner_id::text || '/%'
    and lower(image_path) ~ '\.(jpg|jpeg|png|webp)$'
  )
);

create index listings_active_created_at_idx
  on public.listings (created_at desc)
  where is_active = true;
create index listings_owner_created_at_idx
  on public.listings (owner_id, created_at desc);
create index listings_category_idx
  on public.listings (category)
  where is_active = true;

alter table public.listings enable row level security;

create policy "Anyone can view active listings"
  on public.listings for select to anon, authenticated
  using (is_active = true);

create policy "Owners can view all their listings"
  on public.listings for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Profile owners can create listings"
  on public.listings for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.account_type in ('individual', 'sme')
    )
  );

create policy "Owners can update their listings"
  on public.listings for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their listings"
  on public.listings for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.listings from anon;
revoke all on table public.listings from authenticated;
grant select on table public.listings to anon, authenticated;
grant insert (title, category, description, daily_price, replacement_value, condition, image_path)
  on table public.listings to authenticated;
grant update (title, category, description, daily_price, replacement_value, condition, image_path, is_active)
  on table public.listings to authenticated;
grant delete on table public.listings to authenticated;

create or replace function public.set_listing_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_listing_updated_at
before update on public.listings
for each row execute function public.set_listing_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can view listing images"
  on storage.objects for select to public
  using (bucket_id = 'listing-images');

create policy "Owners can upload listing images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "Owners can update listing images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "Owners can delete listing images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
