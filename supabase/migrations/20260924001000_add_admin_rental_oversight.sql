begin;

create or replace function public.get_admin_rental_requests()
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  renter_name text,
  owner_name text,
  start_date date,
  end_date date,
  duration_days integer,
  rental_total numeric,
  required_deposit numeric,
  status text,
  risk_score integer,
  risk_band text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can view all rental requests.';
  end if;

  return query
  select
    requests.id,
    requests.listing_id,
    requests.listing_title,
    requests.renter_name,
    case
      when owner_profile.account_type = 'sme'
        then coalesce(nullif(btrim(owner_profile.business_name), ''), owner_profile.full_name)
      else owner_profile.full_name
    end as owner_name,
    requests.start_date,
    requests.end_date,
    requests.duration_days,
    requests.rental_total,
    requests.required_deposit,
    requests.status,
    requests.risk_score,
    requests.risk_band,
    requests.created_at
  from public.rental_requests as requests
  join public.profiles as owner_profile on owner_profile.id = requests.owner_id
  order by requests.created_at desc;
end;
$$;

revoke all on function public.get_admin_rental_requests() from public;
grant execute on function public.get_admin_rental_requests() to authenticated;

create or replace function public.prevent_admin_rental_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = new.renter_id and is_admin = true
  ) then
    raise exception 'Administrator accounts cannot submit rental requests.';
  end if;
  return new;
end;
$$;

create trigger prevent_admin_rental_request
before insert on public.rental_requests
for each row execute function public.prevent_admin_rental_request();

commit;
