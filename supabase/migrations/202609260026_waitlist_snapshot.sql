-- Private aggregate for the owner dashboard. It never returns waitlist addresses.
create or replace function public.universe_waitlist_snapshot(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  days integer := least(greatest(coalesce(p_days, 7), 1), 90);
  cutoff timestamptz := now() - make_interval(days => days);
begin
  if not public.universe_backoffice_can('support') then
    raise exception 'BACKOFFICE_ACCESS_REQUIRED' using errcode='42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.universe_waitlist),
    'active', (select count(*) from public.universe_waitlist where unsubscribed_at is null),
    'new_today', (select count(*) from public.universe_waitlist where created_at >= date_trunc('day', now())),
    'new_last_7_days', (select count(*) from public.universe_waitlist where created_at >= cutoff),
    'last_signup_at', (select max(created_at) from public.universe_waitlist),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'total', total) order by total desc) from (select source, count(*)::integer as total from public.universe_waitlist group by source) grouped), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.universe_waitlist_snapshot(integer) from public, anon;
grant execute on function public.universe_waitlist_snapshot(integer) to authenticated;

