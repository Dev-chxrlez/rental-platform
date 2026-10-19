begin;

alter table public.rental_requests
  drop constraint rental_requests_status_check,
  drop constraint rental_request_lifecycle_consistent,
  add constraint rental_requests_status_check check (
    status in ('pending', 'accepted', 'rejected', 'cancelled', 'handed_over', 'returned', 'completed')
  ),
  add constraint rental_request_lifecycle_consistent check (
    (status in ('pending', 'cancelled') and decided_at is null and decided_by is null and handed_over_at is null and returned_at is null and completed_at is null)
    or (status in ('accepted', 'rejected') and decided_at is not null and decided_by = owner_id and handed_over_at is null and returned_at is null and completed_at is null)
    or (status = 'handed_over' and decided_at is not null and decided_by = owner_id and handed_over_at is not null and returned_at is null and completed_at is null)
    or (status = 'returned' and decided_at is not null and decided_by = owner_id and handed_over_at is not null and returned_at is not null and completed_at is null)
    or (status = 'completed' and decided_at is not null and decided_by = owner_id and handed_over_at is not null and returned_at is not null and completed_at is not null)
  );

create function public.cancel_rental_request(p_request_id uuid)
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
    raise exception 'You must be signed in to cancel a rental request.';
  end if;

  select * into request_record
    from public.rental_requests
   where id = p_request_id and renter_id = current_user_id
   for update;

  if not found then
    raise exception 'Rental request not found or you are not its renter.';
  end if;
  if request_record.status <> 'pending' then
    raise exception 'Only a pending rental request can be cancelled.';
  end if;

  update public.rental_requests
     set status = 'cancelled', updated_at = timezone('utc', now())
   where id = request_record.id
   returning * into request_record;

  return request_record;
end;
$$;

revoke all on function public.cancel_rental_request(uuid) from public;
grant execute on function public.cancel_rental_request(uuid) to authenticated;

alter table public.notifications
  drop constraint notifications_type_check,
  add constraint notifications_type_check check (
    type in ('rental_request_created', 'rental_request_accepted', 'rental_request_rejected', 'rental_request_cancelled')
  );

create or replace function public.create_rental_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, rental_request_id, type, title, message)
    values (new.owner_id, new.id, 'rental_request_created', 'New rental request', format('%s requested %s.', new.renter_name, new.listing_title))
    on conflict (user_id, rental_request_id, type) do nothing;
  elsif old.status is distinct from new.status and new.status in ('accepted', 'rejected') then
    insert into public.notifications (user_id, rental_request_id, type, title, message)
    values (
      new.renter_id,
      new.id,
      case new.status when 'accepted' then 'rental_request_accepted' else 'rental_request_rejected' end,
      case new.status when 'accepted' then 'Rental request accepted' else 'Rental request declined' end,
      format('Your request for %s was %s.', new.listing_title, new.status)
    )
    on conflict (user_id, rental_request_id, type) do nothing;
  elsif old.status is distinct from new.status and new.status = 'cancelled' then
    insert into public.notifications (user_id, rental_request_id, type, title, message)
    values (new.owner_id, new.id, 'rental_request_cancelled', 'Rental request cancelled', format('%s cancelled their request for %s.', new.renter_name, new.listing_title))
    on conflict (user_id, rental_request_id, type) do nothing;
  end if;

  return new;
end;
$$;

commit;
