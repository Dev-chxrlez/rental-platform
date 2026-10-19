begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  account_type text not null check (account_type in ('individual', 'sme')),
  business_name text check (business_name is null or char_length(btrim(business_name)) between 1 and 160),
  business_details text check (business_details is null or char_length(business_details) <= 500),
  is_verified boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sme_requires_business_name check (
    account_type <> 'sme' or nullif(btrim(business_name), '') is not null
  )
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Profiles can be inserted by their owner" on public.profiles;
create policy "Profiles can be inserted by their owner"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Profiles are editable by their owner" on public.profiles;
create policy "Profiles are editable by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Restore browser access only for safe operations and user-editable columns.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, full_name, account_type, business_name, business_details)
  on table public.profiles to authenticated;
grant update (full_name, account_type, business_name, business_details)
  on table public.profiles to authenticated;

create or replace function public.set_profile_updated_at()
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

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_account_type text;
  requested_business_name text;
begin
  requested_account_type := case
    when new.raw_user_meta_data ->> 'account_type' = 'sme' then 'sme'
    else 'individual'
  end;
  requested_business_name := nullif(left(btrim(new.raw_user_meta_data ->> 'business_name'), 160), '');

  if requested_account_type = 'sme' and requested_business_name is null then
    raise exception 'A business name is required for SME accounts';
  end if;

  insert into public.profiles (id, full_name, account_type, business_name, business_details)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(coalesce(new.email, 'Member'), '@', 1)
      ),
      120
    ),
    requested_account_type,
    case when requested_account_type = 'sme' then requested_business_name else null end,
    case
      when requested_account_type = 'sme'
        then nullif(left(btrim(new.raw_user_meta_data ->> 'business_details'), 500), '')
      else null
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Backfill Auth users that existed before this migration.
insert into public.profiles (id, full_name, account_type, business_name, business_details)
select
  users.id,
  left(
    coalesce(
      nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(users.email, 'Member'), '@', 1)
    ),
    120
  ),
  case
    when users.raw_user_meta_data ->> 'account_type' = 'sme'
      and nullif(btrim(users.raw_user_meta_data ->> 'business_name'), '') is not null
      then 'sme'
    else 'individual'
  end,
  case
    when users.raw_user_meta_data ->> 'account_type' = 'sme'
      then nullif(left(btrim(users.raw_user_meta_data ->> 'business_name'), 160), '')
    else null
  end,
  case
    when users.raw_user_meta_data ->> 'account_type' = 'sme'
      then nullif(left(btrim(users.raw_user_meta_data ->> 'business_details'), 500), '')
    else null
  end
from auth.users as users
on conflict (id) do nothing;

commit;
