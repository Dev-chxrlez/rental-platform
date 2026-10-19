begin;

alter table public.profiles
  add column introduction text check (
    introduction is null or char_length(btrim(introduction)) between 1 and 300
  ),
  add column avatar_path text,
  add constraint profile_avatar_belongs_to_owner check (
    avatar_path is null
    or (
      avatar_path like id::text || '/%'
      and lower(avatar_path) ~ '\.(jpg|jpeg|png|webp)$'
    )
  );

grant insert (introduction, avatar_path) on table public.profiles to authenticated;
grant update (introduction, avatar_path) on table public.profiles to authenticated;

create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  display_name text,
  account_type text,
  avatar_path text,
  introduction text,
  member_since timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id,
    case
      when profiles.account_type = 'sme'
        then coalesce(nullif(btrim(profiles.business_name), ''), profiles.full_name)
      else profiles.full_name
    end as display_name,
    profiles.account_type,
    profiles.avatar_path,
    profiles.introduction,
    profiles.created_at as member_since
  from public.profiles as profiles
  where profiles.id = p_profile_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can view profile images"
  on storage.objects for select to public
  using (bucket_id = 'profile-images');

create policy "Owners can upload profile images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "Owners can update profile images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-images'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy "Owners can delete profile images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
