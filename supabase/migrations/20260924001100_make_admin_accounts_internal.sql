begin;

create or replace function public.get_public_profile(p_profile_id uuid)
returns table (
  id uuid,
  display_name text,
  account_type text,
  avatar_path text,
  introduction text,
  public_city text,
  public_region text,
  occupation text,
  industry text,
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
    end,
    profiles.account_type,
    profiles.avatar_path,
    profiles.introduction,
    profiles.public_city,
    profiles.public_region,
    case when profiles.account_type = 'individual' then profiles.occupation else null end,
    case when profiles.account_type = 'sme' then profiles.industry else null end,
    profiles.created_at
  from public.profiles as profiles
  where profiles.id = p_profile_id
    and profiles.is_admin = false;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

drop policy if exists "Profile owners can create listings" on public.listings;
create policy "Non-admin profile owners can create listings"
  on public.listings for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.account_type in ('individual', 'sme')
        and profiles.is_admin = false
    )
  );

commit;
