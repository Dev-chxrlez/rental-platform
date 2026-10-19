begin;

alter table public.rental_requests
  drop constraint rental_requests_status_check,
  drop constraint rental_request_decision_consistent,
  drop constraint rental_requests_no_accepted_overlap,
  add column handed_over_at timestamptz,
  add column returned_at timestamptz,
  add column completed_at timestamptz;

drop index public.rental_requests_no_duplicate_open_request_idx;

alter table public.rental_requests
  add constraint rental_requests_status_check check (
    status in ('pending', 'accepted', 'rejected', 'handed_over', 'returned', 'completed')
  ),
  add constraint rental_request_lifecycle_consistent check (
    (status = 'pending' and decided_at is null and decided_by is null and handed_over_at is null and returned_at is null and completed_at is null)
    or (status in ('accepted', 'rejected') and decided_at is not null and decided_by = owner_id and handed_over_at is null and returned_at is null and completed_at is null)
    or (status = 'handed_over' and decided_at is not null and decided_by = owner_id and handed_over_at is not null and returned_at is null and completed_at is null)
    or (status = 'returned' and decided_at is not null and decided_by = owner_id and handed_over_at is not null and returned_at is not null and completed_at is null)
    or (status = 'completed' and decided_at is not null and decided_by = owner_id and handed_over_at is not null and returned_at is not null and completed_at is not null)
  ),
  add constraint rental_request_lifecycle_timestamps_ordered check (
    (handed_over_at is null or handed_over_at >= decided_at)
    and (returned_at is null or returned_at >= handed_over_at)
    and (completed_at is null or completed_at >= returned_at)
  ),
  add constraint rental_requests_no_active_overlap exclude using gist (
    listing_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('accepted', 'handed_over', 'returned', 'completed'));

create unique index rental_requests_no_duplicate_open_request_idx
  on public.rental_requests (listing_id, renter_id, start_date, end_date)
  where status in ('pending', 'accepted', 'handed_over', 'returned', 'completed');

create table public.rental_reviews (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null references public.rental_requests (id) on delete restrict,
  reviewer_id uuid not null references auth.users (id) on delete restrict,
  recipient_id uuid not null references auth.users (id) on delete restrict,
  reviewer_role text not null check (reviewer_role in ('renter', 'owner')),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(btrim(comment)) between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  constraint rental_review_parties_differ check (reviewer_id <> recipient_id),
  constraint rental_review_once_per_role unique (rental_request_id, reviewer_role),
  constraint rental_review_once_per_reviewer unique (rental_request_id, reviewer_id)
);

create index rental_reviews_recipient_role_created_at_idx
  on public.rental_reviews (recipient_id, reviewer_role, created_at desc);

alter table public.rental_reviews enable row level security;

create policy "Review participants can view reviews"
  on public.rental_reviews for select to authenticated
  using ((select auth.uid()) = reviewer_id or (select auth.uid()) = recipient_id);

revoke all on table public.rental_reviews from anon;
revoke all on table public.rental_reviews from authenticated;
grant select on table public.rental_reviews to authenticated;

create function public.validate_rental_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_record public.rental_requests%rowtype;
begin
  select * into request_record from public.rental_requests where id = new.rental_request_id;
  if not found or request_record.status <> 'completed' then
    raise exception 'Reviews are only allowed after a completed rental.';
  end if;
  if new.reviewer_role = 'renter' then
    if new.reviewer_id <> request_record.renter_id or new.recipient_id <> request_record.owner_id then
      raise exception 'The renter review parties do not match this rental.';
    end if;
  elsif new.reviewer_role = 'owner' then
    if new.reviewer_id <> request_record.owner_id or new.recipient_id <> request_record.renter_id then
      raise exception 'The owner review parties do not match this rental.';
    end if;
  end if;
  new.comment := nullif(btrim(new.comment), '');
  return new;
end;
$$;

create trigger validate_rental_review_before_insert
before insert on public.rental_reviews
for each row execute function public.validate_rental_review();

create or replace function public.decide_rental_request(p_request_id uuid, p_decision text)
returns public.rental_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
begin
  if current_user_id is null then raise exception 'You must be signed in to decide a rental request.'; end if;
  if p_decision is null or p_decision not in ('accepted', 'rejected') then raise exception 'Decision must be accepted or rejected.'; end if;
  select * into request_record from public.rental_requests where id = p_request_id and owner_id = current_user_id for update;
  if not found then raise exception 'Rental request not found or you are not its owner.'; end if;
  if request_record.status <> 'pending' then raise exception 'This rental request has already been decided.'; end if;
  if p_decision = 'accepted' then
    perform 1 from public.listings where id = request_record.listing_id for update;
    if exists (
      select 1 from public.rental_requests
       where listing_id = request_record.listing_id
         and status in ('accepted', 'handed_over', 'returned', 'completed')
         and id <> request_record.id
         and daterange(start_date, end_date, '[]') && daterange(request_record.start_date, request_record.end_date, '[]')
    ) then raise exception 'This listing is already approved for overlapping dates.'; end if;
  end if;
  update public.rental_requests
     set status = p_decision, decided_at = timezone('utc', now()), decided_by = current_user_id, updated_at = timezone('utc', now())
   where id = request_record.id returning * into request_record;
  return request_record;
end;
$$;

create function public.advance_rental_request(p_request_id uuid, p_action text)
returns public.rental_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
begin
  if current_user_id is null then raise exception 'You must be signed in to update a rental.'; end if;
  select * into request_record from public.rental_requests
   where id = p_request_id and (owner_id = current_user_id or renter_id = current_user_id) for update;
  if not found then raise exception 'Rental request not found or you are not a participant.'; end if;
  if p_action = 'confirm_handover' then
    if current_user_id <> request_record.owner_id or request_record.status <> 'accepted' then
      raise exception 'Only the owner can confirm handover for an accepted rental.';
    end if;
    update public.rental_requests set status = 'handed_over', handed_over_at = timezone('utc', now()), updated_at = timezone('utc', now())
     where id = request_record.id returning * into request_record;
  elsif p_action = 'mark_returned' then
    if current_user_id <> request_record.renter_id or request_record.status <> 'handed_over' then
      raise exception 'Only the renter can mark a handed-over item as returned.';
    end if;
    update public.rental_requests set status = 'returned', returned_at = timezone('utc', now()), updated_at = timezone('utc', now())
     where id = request_record.id returning * into request_record;
  elsif p_action = 'confirm_receipt' then
    if current_user_id <> request_record.owner_id or request_record.status <> 'returned' then
      raise exception 'Only the owner can confirm receipt of a returned item.';
    end if;
    update public.rental_requests set status = 'completed', completed_at = timezone('utc', now()), updated_at = timezone('utc', now())
     where id = request_record.id returning * into request_record;
  else
    raise exception 'Unknown rental action.';
  end if;
  return request_record;
end;
$$;

create function public.submit_rental_review(p_request_id uuid, p_rating integer, p_comment text default null)
returns public.rental_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
  review_role text;
  review_recipient uuid;
  created_review public.rental_reviews%rowtype;
begin
  if current_user_id is null then raise exception 'You must be signed in to submit a review.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5 stars.'; end if;
  if p_comment is not null and char_length(btrim(p_comment)) > 1000 then raise exception 'Review comments cannot exceed 1000 characters.'; end if;
  select * into request_record from public.rental_requests
   where id = p_request_id and status = 'completed' and (owner_id = current_user_id or renter_id = current_user_id) for share;
  if not found then raise exception 'Only a participant can review a completed rental.'; end if;
  if current_user_id = request_record.renter_id then
    review_role := 'renter'; review_recipient := request_record.owner_id;
  else
    review_role := 'owner'; review_recipient := request_record.renter_id;
  end if;
  insert into public.rental_reviews (rental_request_id, reviewer_id, recipient_id, reviewer_role, rating, comment)
  values (request_record.id, current_user_id, review_recipient, review_role, p_rating, nullif(btrim(p_comment), ''))
  returning * into created_review;
  return created_review;
exception when unique_violation then
  raise exception 'You have already reviewed this rental.';
end;
$$;

create function public.get_public_reputation(p_profile_id uuid)
returns table (
  owner_average_rating numeric, owner_review_count bigint, completed_as_owner bigint,
  renter_average_rating numeric, renter_review_count bigint, completed_as_renter bigint,
  renter_on_time_returns bigint, renter_returns_recorded bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    round(avg(reviews.rating) filter (where reviews.reviewer_role = 'renter'), 1),
    count(reviews.id) filter (where reviews.reviewer_role = 'renter'),
    (select count(*) from public.rental_requests where owner_id = p_profile_id and status = 'completed'),
    round(avg(reviews.rating) filter (where reviews.reviewer_role = 'owner'), 1),
    count(reviews.id) filter (where reviews.reviewer_role = 'owner'),
    (select count(*) from public.rental_requests where renter_id = p_profile_id and status = 'completed'),
    (select count(*) from public.rental_requests where renter_id = p_profile_id and status = 'completed' and returned_at is not null and (returned_at at time zone 'UTC')::date <= end_date),
    (select count(*) from public.rental_requests where renter_id = p_profile_id and status = 'completed' and returned_at is not null)
  from public.rental_reviews as reviews where reviews.recipient_id = p_profile_id;
$$;

create function public.get_public_reviews(p_profile_id uuid)
returns table (id uuid, reviewer_role text, rating smallint, comment text, created_at timestamptz, reviewer_display_name text)
language sql stable security definer set search_path = ''
as $$
  select reviews.id, reviews.reviewer_role, reviews.rating, reviews.comment, reviews.created_at,
    case when profiles.account_type = 'sme'
      then coalesce(nullif(btrim(profiles.business_name), ''), profiles.full_name)
      else profiles.full_name end
  from public.rental_reviews as reviews
  join public.profiles as profiles on profiles.id = reviews.reviewer_id
  where reviews.recipient_id = p_profile_id
  order by reviews.created_at desc;
$$;

revoke all on function public.advance_rental_request(uuid, text) from public;
revoke all on function public.submit_rental_review(uuid, integer, text) from public;
revoke all on function public.get_public_reputation(uuid) from public;
revoke all on function public.get_public_reviews(uuid) from public;
grant execute on function public.advance_rental_request(uuid, text) to authenticated;
grant execute on function public.submit_rental_review(uuid, integer, text) to authenticated;
grant execute on function public.get_public_reputation(uuid) to anon, authenticated;
grant execute on function public.get_public_reviews(uuid) to anon, authenticated;

commit;
