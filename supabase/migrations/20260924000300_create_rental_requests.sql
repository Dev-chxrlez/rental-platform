begin;

create extension if not exists btree_gist with schema extensions;

create table public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete restrict,
  renter_id uuid not null references auth.users (id) on delete restrict,
  owner_id uuid not null references auth.users (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  duration_days integer not null check (duration_days between 1 and 90),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  listing_title text not null check (char_length(btrim(listing_title)) between 3 and 120),
  daily_price numeric(10, 2) not null check (daily_price > 0),
  replacement_value numeric(12, 2) not null check (replacement_value > 0),
  rental_total numeric(12, 2) not null check (rental_total > 0),
  renter_name text not null check (char_length(btrim(renter_name)) between 1 and 120),
  renter_account_type text not null check (renter_account_type in ('individual', 'sme')),
  renter_business_name text check (
    renter_business_name is null or char_length(btrim(renter_business_name)) between 1 and 160
  ),
  renter_is_verified boolean not null,
  renter_account_age_days integer not null check (renter_account_age_days >= 0),
  risk_score integer not null check (risk_score between 0 and 100),
  risk_band text not null check (risk_band in ('low', 'medium', 'high')),
  risk_factors jsonb not null check (jsonb_typeof(risk_factors) = 'object'),
  risk_explanation text not null check (char_length(btrim(risk_explanation)) between 20 and 2000),
  safeguard_requirements jsonb not null check (
    jsonb_typeof(safeguard_requirements) = 'array'
    and jsonb_array_length(safeguard_requirements) >= 1
  ),
  required_deposit numeric(12, 2) not null default 0 check (required_deposit >= 0),
  rule_version text not null check (rule_version = 'rental-risk-v1'),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rental_request_dates_valid check (end_date >= start_date),
  constraint rental_request_duration_matches_dates check (
    duration_days = (end_date - start_date) + 1
  ),
  constraint rental_request_total_matches_duration check (
    rental_total = round(daily_price * duration_days, 2)
  ),
  constraint rental_request_parties_differ check (renter_id <> owner_id),
  constraint rental_request_risk_band_matches_score check (
    (risk_band = 'low' and risk_score between 0 and 19)
    or (risk_band = 'medium' and risk_score between 20 and 39)
    or (risk_band = 'high' and risk_score between 40 and 100)
  ),
  constraint rental_request_deposit_matches_band check (
    (risk_band = 'low' and required_deposit = 0)
    or (risk_band = 'medium' and required_deposit = round(replacement_value * 0.10, 2))
    or (risk_band = 'high' and required_deposit = round(replacement_value * 0.20, 2))
  ),
  constraint rental_request_decision_consistent check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or
    (status in ('accepted', 'rejected') and decided_at is not null and decided_by = owner_id)
  ),
  constraint rental_requests_no_accepted_overlap exclude using gist (
    listing_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status = 'accepted')
);

create index rental_requests_renter_created_at_idx
  on public.rental_requests (renter_id, created_at desc);
create index rental_requests_owner_status_created_at_idx
  on public.rental_requests (owner_id, status, created_at desc);
create index rental_requests_listing_dates_idx
  on public.rental_requests (listing_id, start_date, end_date);
create unique index rental_requests_no_duplicate_open_request_idx
  on public.rental_requests (listing_id, renter_id, start_date, end_date)
  where status in ('pending', 'accepted');

alter table public.rental_requests enable row level security;

create policy "Participants can view rental requests"
  on public.rental_requests for select to authenticated
  using ((select auth.uid()) = renter_id or (select auth.uid()) = owner_id);

revoke all on table public.rental_requests from anon;
revoke all on table public.rental_requests from authenticated;
grant select on table public.rental_requests to authenticated;

create or replace function public.create_rental_request(
  p_listing_id uuid,
  p_start_date date,
  p_end_date date
)
returns public.rental_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing_record public.listings%rowtype;
  renter_profile public.profiles%rowtype;
  rental_days integer;
  verification_points integer;
  value_points integer;
  duration_points integer;
  calculated_score integer;
  calculated_band text;
  deposit_amount numeric(12, 2);
  factor_snapshot jsonb;
  safeguard_snapshot jsonb;
  explanation text;
  created_request public.rental_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to request a rental.';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Choose both a start date and an end date.';
  end if;

  if p_start_date < current_date then
    raise exception 'The rental start date cannot be in the past.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'The rental end date must be on or after the start date.';
  end if;

  rental_days := (p_end_date - p_start_date) + 1;
  if rental_days > 90 then
    raise exception 'A rental request cannot exceed 90 days.';
  end if;

  select *
    into listing_record
    from public.listings
   where id = p_listing_id
     and is_active = true
   for share;

  if not found then
    raise exception 'This listing is unavailable or inactive.';
  end if;

  if listing_record.owner_id = current_user_id then
    raise exception 'You cannot request your own listing.';
  end if;

  select *
    into renter_profile
    from public.profiles
   where id = current_user_id;

  if not found then
    raise exception 'Complete your profile before requesting a rental.';
  end if;

  if exists (
    select 1
      from public.rental_requests
     where listing_id = p_listing_id
       and renter_id = current_user_id
       and start_date = p_start_date
       and end_date = p_end_date
       and status in ('pending', 'accepted')
  ) then
    raise exception 'You already have an open request for these dates.';
  end if;

  verification_points := case when renter_profile.is_verified then 0 else 15 end;
  value_points := case
    when listing_record.replacement_value <= 25000 then 0
    when listing_record.replacement_value <= 100000 then 10
    when listing_record.replacement_value <= 250000 then 20
    else 30
  end;
  duration_points := case
    when rental_days <= 3 then 0
    when rental_days <= 7 then 8
    when rental_days <= 14 then 15
    else 25
  end;
  calculated_score := verification_points + value_points + duration_points;
  calculated_band := case
    when calculated_score <= 19 then 'low'
    when calculated_score <= 39 then 'medium'
    else 'high'
  end;
  deposit_amount := case calculated_band
    when 'medium' then round(listing_record.replacement_value * 0.10, 2)
    when 'high' then round(listing_record.replacement_value * 0.20, 2)
    else 0
  end;

  factor_snapshot := jsonb_build_object(
    'verification', jsonb_build_object(
      'label', 'Account verification',
      'value', case when renter_profile.is_verified then 'verified' else 'not_verified' end,
      'points', verification_points
    ),
    'replacement_value', jsonb_build_object(
      'label', 'Listing replacement value',
      'value', listing_record.replacement_value,
      'points', value_points
    ),
    'rental_duration', jsonb_build_object(
      'label', 'Rental duration',
      'value', rental_days,
      'points', duration_points
    ),
    'history', jsonb_build_object(
      'label', 'Rental history',
      'value', 'limited_history',
      'points', 0,
      'note', 'No completed-rental history is stored yet, so limited history is treated as neutral.'
    )
  );

  safeguard_snapshot := jsonb_build_array(
    jsonb_build_object(
      'code', 'owner_approval',
      'label', 'Owner approval is required before the rental can proceed.'
    )
  );
  if deposit_amount > 0 then
    safeguard_snapshot := safeguard_snapshot || jsonb_build_array(
      jsonb_build_object(
        'code', 'deposit_required',
        'label', 'A refundable deposit is required before handover.',
        'amount', deposit_amount
      )
    );
  end if;

  explanation := format(
    'Risk score %s (%s). Verification contributes %s points, replacement value contributes %s points, and the %s-day duration contributes %s points. Limited rental history is recorded as neutral and does not add points.',
    calculated_score,
    calculated_band,
    verification_points,
    value_points,
    rental_days,
    duration_points
  );

  insert into public.rental_requests (
    listing_id,
    renter_id,
    owner_id,
    start_date,
    end_date,
    duration_days,
    listing_title,
    daily_price,
    replacement_value,
    rental_total,
    renter_name,
    renter_account_type,
    renter_business_name,
    renter_is_verified,
    renter_account_age_days,
    risk_score,
    risk_band,
    risk_factors,
    risk_explanation,
    safeguard_requirements,
    required_deposit,
    rule_version
  ) values (
    listing_record.id,
    current_user_id,
    listing_record.owner_id,
    p_start_date,
    p_end_date,
    rental_days,
    listing_record.title,
    listing_record.daily_price,
    listing_record.replacement_value,
    round(listing_record.daily_price * rental_days, 2),
    renter_profile.full_name,
    renter_profile.account_type,
    case when renter_profile.account_type = 'sme' then renter_profile.business_name else null end,
    renter_profile.is_verified,
    greatest(current_date - renter_profile.created_at::date, 0),
    calculated_score,
    calculated_band,
    factor_snapshot,
    explanation,
    safeguard_snapshot,
    deposit_amount,
    'rental-risk-v1'
  )
  returning * into created_request;

  return created_request;
end;
$$;

create or replace function public.decide_rental_request(
  p_request_id uuid,
  p_decision text
)
returns public.rental_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to decide a rental request.';
  end if;

  if p_decision is null or p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected.';
  end if;

  select *
    into request_record
    from public.rental_requests
   where id = p_request_id
     and owner_id = current_user_id
   for update;

  if not found then
    raise exception 'Rental request not found or you are not its owner.';
  end if;

  if request_record.status <> 'pending' then
    raise exception 'This rental request has already been decided.';
  end if;

  if p_decision = 'accepted' then
    perform 1
      from public.listings
     where id = request_record.listing_id
     for update;

    if exists (
      select 1
        from public.rental_requests
       where listing_id = request_record.listing_id
         and status = 'accepted'
         and id <> request_record.id
         and daterange(start_date, end_date, '[]')
             && daterange(request_record.start_date, request_record.end_date, '[]')
    ) then
      raise exception 'This listing is already approved for overlapping dates.';
    end if;
  end if;

  update public.rental_requests
     set status = p_decision,
         decided_at = timezone('utc', now()),
         decided_by = current_user_id,
         updated_at = timezone('utc', now())
   where id = request_record.id
  returning * into request_record;

  return request_record;
end;
$$;

revoke all on function public.create_rental_request(uuid, date, date) from public;
revoke all on function public.decide_rental_request(uuid, text) from public;
grant execute on function public.create_rental_request(uuid, date, date) to authenticated;
grant execute on function public.decide_rental_request(uuid, text) to authenticated;

commit;
