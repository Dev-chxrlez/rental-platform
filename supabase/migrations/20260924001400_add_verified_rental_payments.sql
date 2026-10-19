begin;

alter table public.rental_requests
  add column deposit_payment_method text check (deposit_payment_method in ('gcash', 'bank')),
  add column deposit_proof_path text,
  add column deposit_submitted_at timestamptz,
  add column deposit_verified_at timestamptz,
  add column rental_payment_method text check (rental_payment_method in ('cash', 'gcash', 'bank')),
  add column rental_payment_proof_path text,
  add column rental_payment_submitted_at timestamptz,
  add column rental_payment_confirmed_at timestamptz,
  add constraint rental_request_deposit_submission_consistent check (
    (deposit_submitted_at is null and deposit_payment_method is null and deposit_proof_path is null and deposit_verified_at is null)
    or (deposit_submitted_at is not null and deposit_payment_method is not null and deposit_proof_path is not null)
  ),
  add constraint rental_request_payment_submission_consistent check (
    (rental_payment_submitted_at is null and rental_payment_method is null and rental_payment_proof_path is null and rental_payment_confirmed_at is null)
    or (
      rental_payment_submitted_at is not null
      and rental_payment_method is not null
      and (rental_payment_method = 'cash' or rental_payment_proof_path is not null)
    )
  );

create function public.submit_rental_deposit(p_request_id uuid, p_method text, p_proof_path text)
returns public.rental_requests
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
begin
  select * into request_record from public.rental_requests
   where id = p_request_id and renter_id = current_user_id for update;
  if not found then raise exception 'Rental request not found or you are not its renter.'; end if;
  if request_record.status <> 'pending' then raise exception 'The deposit can only be submitted while the request is pending.'; end if;
  if request_record.required_deposit <= 0 then raise exception 'This request does not require a deposit.'; end if;
  if p_method is null or p_method not in ('gcash', 'bank') then raise exception 'Choose GCash or bank transfer for the deposit.'; end if;
  if p_proof_path is null or p_proof_path not like current_user_id::text || '/' || request_record.id::text || '/%' then
    raise exception 'Upload a valid deposit payment receipt.';
  end if;
  update public.rental_requests set deposit_payment_method = p_method, deposit_proof_path = p_proof_path,
    deposit_submitted_at = timezone('utc', now()), deposit_verified_at = null, updated_at = timezone('utc', now())
   where id = request_record.id returning * into request_record;
  return request_record;
end;
$$;

create or replace function public.decide_rental_request(p_request_id uuid, p_decision text)
returns public.rental_requests
language plpgsql security definer set search_path = ''
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
    if request_record.required_deposit > 0 and request_record.deposit_submitted_at is null then
      raise exception 'The renter must submit the required deposit before this request can be accepted.';
    end if;
    perform 1 from public.listings where id = request_record.listing_id for update;
    if exists (select 1 from public.rental_requests where listing_id = request_record.listing_id
      and status in ('accepted', 'handed_over', 'returned', 'completed') and id <> request_record.id
      and daterange(start_date, end_date, '[]') && daterange(request_record.start_date, request_record.end_date, '[]')) then
      raise exception 'This listing is already approved for overlapping dates.';
    end if;
  end if;
  update public.rental_requests set status = p_decision, decided_at = timezone('utc', now()), decided_by = current_user_id,
    deposit_verified_at = case when p_decision = 'accepted' and required_deposit > 0 then timezone('utc', now()) else deposit_verified_at end,
    updated_at = timezone('utc', now()) where id = request_record.id returning * into request_record;
  return request_record;
end;
$$;

create function public.submit_rental_payment(p_request_id uuid, p_method text, p_proof_path text default null)
returns public.rental_requests
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
begin
  select * into request_record from public.rental_requests
   where id = p_request_id and renter_id = current_user_id for update;
  if not found then raise exception 'Rental request not found or you are not its renter.'; end if;
  if request_record.status not in ('handed_over', 'returned') then raise exception 'Rental payment can be recorded after handover.'; end if;
  if p_method is null or p_method not in ('cash', 'gcash', 'bank') then raise exception 'Choose Cash, GCash, or bank transfer.'; end if;
  if p_method <> 'cash' and (p_proof_path is null or p_proof_path not like current_user_id::text || '/' || request_record.id::text || '/%') then
    raise exception 'Upload a valid payment receipt for GCash or bank transfer.';
  end if;
  update public.rental_requests set rental_payment_method = p_method,
    rental_payment_proof_path = case when p_method = 'cash' then null else p_proof_path end,
    rental_payment_submitted_at = timezone('utc', now()), rental_payment_confirmed_at = null,
    updated_at = timezone('utc', now()) where id = request_record.id returning * into request_record;
  return request_record;
end;
$$;

create function public.confirm_rental_payment(p_request_id uuid)
returns public.rental_requests
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
begin
  select * into request_record from public.rental_requests
   where id = p_request_id and owner_id = current_user_id for update;
  if not found then raise exception 'Rental request not found or you are not its owner.'; end if;
  if request_record.status not in ('handed_over', 'returned') then raise exception 'Payment can only be confirmed after handover.'; end if;
  if request_record.rental_payment_submitted_at is null then raise exception 'The renter has not recorded payment yet.'; end if;
  update public.rental_requests set rental_payment_confirmed_at = timezone('utc', now()), updated_at = timezone('utc', now())
   where id = request_record.id returning * into request_record;
  return request_record;
end;
$$;

create or replace function public.advance_rental_request(p_request_id uuid, p_action text)
returns public.rental_requests
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  request_record public.rental_requests%rowtype;
begin
  if current_user_id is null then raise exception 'You must be signed in to update a rental.'; end if;
  select * into request_record from public.rental_requests where id = p_request_id
    and (owner_id = current_user_id or renter_id = current_user_id) for update;
  if not found then raise exception 'Rental request not found or you are not a participant.'; end if;
  if p_action = 'confirm_handover' then
    if current_user_id <> request_record.owner_id or request_record.status <> 'accepted' then raise exception 'Only the owner can confirm handover for an accepted rental.'; end if;
    update public.rental_requests set status = 'handed_over', handed_over_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = request_record.id returning * into request_record;
  elsif p_action = 'mark_returned' then
    if current_user_id <> request_record.renter_id or request_record.status <> 'handed_over' then raise exception 'Only the renter can mark a handed-over item as returned.'; end if;
    update public.rental_requests set status = 'returned', returned_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = request_record.id returning * into request_record;
  elsif p_action = 'confirm_receipt' then
    if current_user_id <> request_record.owner_id or request_record.status <> 'returned' then raise exception 'Only the owner can confirm receipt of a returned item.'; end if;
    if request_record.rental_payment_confirmed_at is null then raise exception 'Confirm the rental payment before completing this rental.'; end if;
    update public.rental_requests set status = 'completed', completed_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = request_record.id returning * into request_record;
  else raise exception 'Unknown rental action.';
  end if;
  return request_record;
end;
$$;

revoke all on function public.submit_rental_deposit(uuid, text, text) from public;
revoke all on function public.submit_rental_payment(uuid, text, text) from public;
revoke all on function public.confirm_rental_payment(uuid) from public;
grant execute on function public.submit_rental_deposit(uuid, text, text) to authenticated;
grant execute on function public.submit_rental_payment(uuid, text, text) to authenticated;
grant execute on function public.confirm_rental_payment(uuid) to authenticated;

drop policy "Accepted renters can view owner payment methods" on public.payment_methods;
create policy "Requesting renters can view owner payment methods" on public.payment_methods for select to authenticated
using (is_enabled = true and exists (select 1 from public.rental_requests where rental_requests.owner_id = payment_methods.owner_id
  and rental_requests.renter_id = (select auth.uid()) and rental_requests.status in ('pending', 'accepted', 'handed_over', 'returned')));

drop policy "Accepted renters can view payment QR codes" on storage.objects;
create policy "Requesting renters can view payment QR codes" on storage.objects for select to authenticated
using (bucket_id = 'payment-qr-codes' and exists (select 1 from public.rental_requests
  where rental_requests.owner_id::text = (storage.foldername(name))[1] and rental_requests.renter_id = (select auth.uid())
    and rental_requests.status in ('pending', 'accepted', 'handed_over', 'returned')));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Renters can upload their payment receipts" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.rental_requests where id::text = (storage.foldername(name))[2]
    and renter_id = (select auth.uid()) and status in ('pending', 'handed_over', 'returned')));
create policy "Participants can view payment receipts" on storage.objects for select to authenticated
using (bucket_id = 'payment-receipts' and exists (select 1 from public.rental_requests
  where id::text = (storage.foldername(name))[2] and (renter_id = (select auth.uid()) or owner_id = (select auth.uid()))));

alter table public.notifications
  drop constraint notifications_type_check,
  add constraint notifications_type_check check (type in (
    'rental_request_created', 'rental_request_accepted', 'rental_request_rejected', 'rental_request_cancelled',
    'deposit_submitted', 'rental_payment_submitted', 'rental_payment_confirmed'
  ));

create function public.create_payment_update_notification()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.deposit_submitted_at is distinct from new.deposit_submitted_at and new.deposit_submitted_at is not null then
    insert into public.notifications (user_id, rental_request_id, type, title, message)
    values (new.owner_id, new.id, 'deposit_submitted', 'Deposit submitted', format('%s submitted the required deposit for %s.', new.renter_name, new.listing_title))
    on conflict (user_id, rental_request_id, type) do nothing;
  end if;
  if old.rental_payment_submitted_at is distinct from new.rental_payment_submitted_at and new.rental_payment_submitted_at is not null then
    insert into public.notifications (user_id, rental_request_id, type, title, message)
    values (new.owner_id, new.id, 'rental_payment_submitted', 'Rental payment recorded', format('%s recorded payment for %s.', new.renter_name, new.listing_title))
    on conflict (user_id, rental_request_id, type) do nothing;
  end if;
  if old.rental_payment_confirmed_at is distinct from new.rental_payment_confirmed_at and new.rental_payment_confirmed_at is not null then
    insert into public.notifications (user_id, rental_request_id, type, title, message)
    values (new.renter_id, new.id, 'rental_payment_confirmed', 'Payment confirmed', format('The owner confirmed payment for %s.', new.listing_title))
    on conflict (user_id, rental_request_id, type) do nothing;
  end if;
  return new;
end;
$$;

create trigger create_payment_update_notification_after_update
after update of deposit_submitted_at, rental_payment_submitted_at, rental_payment_confirmed_at on public.rental_requests
for each row execute function public.create_payment_update_notification();

revoke all on function public.create_payment_update_notification() from public;

commit;
