begin;

alter table public.listings
  add column moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  add column moderation_note text check (
    moderation_note is null or char_length(btrim(moderation_note)) between 1 and 500
  ),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add constraint listing_moderation_state_consistent check (
    (moderation_status = 'pending' and reviewed_at is null and reviewed_by is null and moderation_note is null)
    or (moderation_status = 'approved' and reviewed_at is not null and reviewed_by is not null and moderation_note is null)
    or (moderation_status = 'rejected' and reviewed_at is not null and reviewed_by is not null and moderation_note is not null)
  );

-- Listings already visible before this migration stay visible.
update public.listings
set moderation_status = 'approved', reviewed_at = created_at, reviewed_by = owner_id;

create index listings_moderation_queue_idx
  on public.listings (created_at asc)
  where moderation_status = 'pending';

drop policy if exists "Anyone can view active listings" on public.listings;
create policy "Anyone can view approved active listings"
  on public.listings for select to anon, authenticated
  using (is_active = true and moderation_status = 'approved');

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select profiles.is_admin from public.profiles as profiles where profiles.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

create policy "Admins can view all listings"
  on public.listings for select to authenticated
  using ((select public.current_user_is_admin()));

create or replace function public.reset_listing_moderation_after_owner_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.title is distinct from old.title
    or new.category is distinct from old.category
    or new.description is distinct from old.description
    or new.daily_price is distinct from old.daily_price
    or new.replacement_value is distinct from old.replacement_value
    or new.condition is distinct from old.condition
    or new.image_path is distinct from old.image_path
  then
    new.moderation_status := 'pending';
    new.moderation_note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

create trigger reset_listing_moderation_after_owner_edit
before update on public.listings
for each row execute function public.reset_listing_moderation_after_owner_edit();

create or replace function public.review_listing(
  p_listing_id uuid,
  p_decision text,
  p_note text default null
)
returns public.listings
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewer_id uuid := (select auth.uid());
  reviewed_listing public.listings%rowtype;
  clean_note text := nullif(left(btrim(p_note), 500), '');
begin
  if reviewer_id is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can review listings.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;
  if p_decision = 'rejected' and clean_note is null then
    raise exception 'Add a reason when rejecting a listing.';
  end if;

  update public.listings
  set moderation_status = p_decision,
      moderation_note = case when p_decision = 'rejected' then clean_note else null end,
      reviewed_at = timezone('utc', now()),
      reviewed_by = reviewer_id
  where id = p_listing_id
  returning * into reviewed_listing;

  if not found then raise exception 'Listing not found.'; end if;
  return reviewed_listing;
end;
$$;

revoke all on function public.review_listing(uuid, text, text) from public;
grant execute on function public.review_listing(uuid, text, text) to authenticated;

-- The existing request RPC is security-definer, so enforce approval at the table boundary too.
create or replace function public.require_approved_listing_for_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.listings
    where id = new.listing_id and is_active = true and moderation_status = 'approved'
  ) then
    raise exception 'This listing is not approved and available for rental.';
  end if;
  return new;
end;
$$;

create trigger require_approved_listing_for_request
before insert on public.rental_requests
for each row execute function public.require_approved_listing_for_request();

commit;
