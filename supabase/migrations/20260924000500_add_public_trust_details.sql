begin;

alter table public.profiles
  add column public_city text check (
    public_city is null or char_length(btrim(public_city)) between 2 and 100
  ),
  add column public_region text check (
    public_region is null or char_length(btrim(public_region)) between 2 and 100
  ),
  add column occupation text check (
    occupation is null or char_length(btrim(occupation)) between 2 and 120
  ),
  add column industry text check (
    industry is null or char_length(btrim(industry)) between 2 and 120
  );

grant insert (public_city, public_region, occupation, industry)
  on table public.profiles to authenticated;
grant update (public_city, public_region, occupation, industry)
  on table public.profiles to authenticated;

drop function public.get_public_profile(uuid);

create function public.get_public_profile(p_profile_id uuid)
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
    end as display_name,
    profiles.account_type,
    profiles.avatar_path,
    profiles.introduction,
    profiles.public_city,
    profiles.public_region,
    case when profiles.account_type = 'individual' then profiles.occupation else null end,
    case when profiles.account_type = 'sme' then profiles.industry else null end,
    profiles.created_at as member_since
  from public.profiles as profiles
  where profiles.id = p_profile_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

commit;
