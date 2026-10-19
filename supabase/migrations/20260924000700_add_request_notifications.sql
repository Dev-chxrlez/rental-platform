begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rental_request_id uuid not null references public.rental_requests (id) on delete cascade,
  type text not null check (type in ('rental_request_created', 'rental_request_accepted', 'rental_request_rejected')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  message text not null check (char_length(btrim(message)) between 1 and 300),
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint notification_event_unique unique (user_id, rental_request_id, type)
);

create index notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where is_read = false;

alter table public.notifications enable row level security;

create policy "Users can view their notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can mark their notifications read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

create function public.create_rental_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (
      user_id,
      rental_request_id,
      type,
      title,
      message
    ) values (
      new.owner_id,
      new.id,
      'rental_request_created',
      'New rental request',
      format('%s requested %s.', new.renter_name, new.listing_title)
    )
    on conflict (user_id, rental_request_id, type) do nothing;
  elsif old.status is distinct from new.status and new.status in ('accepted', 'rejected') then
    insert into public.notifications (
      user_id,
      rental_request_id,
      type,
      title,
      message
    ) values (
      new.renter_id,
      new.id,
      case new.status
        when 'accepted' then 'rental_request_accepted'
        else 'rental_request_rejected'
      end,
      case new.status
        when 'accepted' then 'Rental request accepted'
        else 'Rental request declined'
      end,
      format('Your request for %s was %s.', new.listing_title, new.status)
    )
    on conflict (user_id, rental_request_id, type) do nothing;
  end if;

  return new;
end;
$$;

create trigger create_rental_request_notification_after_insert
after insert on public.rental_requests
for each row execute function public.create_rental_request_notification();

create trigger create_rental_request_notification_after_decision
after update of status on public.rental_requests
for each row execute function public.create_rental_request_notification();

revoke all on function public.create_rental_request_notification() from public;

commit;
