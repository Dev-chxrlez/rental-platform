begin;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dashboard jsonb;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not public.current_user_is_admin() then
    raise exception 'Only administrators can view dashboard data.';
  end if;

  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'individuals', (select count(*) from public.profiles where account_type = 'individual'),
      'businesses', (select count(*) from public.profiles where account_type = 'sme')
    ),
    'listings', jsonb_build_object(
      'total', (select count(*) from public.listings),
      'pending', (select count(*) from public.listings where moderation_status = 'pending'),
      'approved', (select count(*) from public.listings where moderation_status = 'approved'),
      'rejected', (select count(*) from public.listings where moderation_status = 'rejected'),
      'active', (select count(*) from public.listings where moderation_status = 'approved' and is_active = true)
    ),
    'requests', jsonb_build_object(
      'total', (select count(*) from public.rental_requests),
      'pending', (select count(*) from public.rental_requests where status = 'pending'),
      'accepted', (select count(*) from public.rental_requests where status in ('accepted', 'handed_over', 'returned')),
      'completed', (select count(*) from public.rental_requests where status = 'completed'),
      'rejected', (select count(*) from public.rental_requests where status = 'rejected')
    ),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', days.day,
        'listings', (select count(*) from public.listings where created_at::date = days.day::date),
        'members', (select count(*) from public.profiles where created_at::date = days.day::date),
        'requests', (select count(*) from public.rental_requests where created_at::date = days.day::date)
      ) order by days.day)
      from generate_series(current_date - 13, current_date, interval '1 day') as days(day)
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('category', category_counts.category, 'count', category_counts.total) order by category_counts.total desc)
      from (
        select category, count(*) as total
        from public.listings
        where moderation_status = 'approved' and is_active = true
        group by category
      ) as category_counts
    ), '[]'::jsonb),
    'recent_listings', coalesce((
      select jsonb_agg(recent_listing order by recent_listing.created_at desc)
      from (
        select
          listings.id,
          listings.title,
          listings.moderation_status,
          listings.is_active,
          listings.created_at,
          case
            when profiles.account_type = 'sme'
              then coalesce(nullif(btrim(profiles.business_name), ''), profiles.full_name)
            else profiles.full_name
          end as owner_name
        from public.listings as listings
        join public.profiles as profiles on profiles.id = listings.owner_id
        order by listings.created_at desc
        limit 6
      ) as recent_listing
    ), '[]'::jsonb)
  ) into dashboard;

  return dashboard;
end;
$$;

revoke all on function public.get_admin_dashboard() from public;
grant execute on function public.get_admin_dashboard() to authenticated;

commit;
