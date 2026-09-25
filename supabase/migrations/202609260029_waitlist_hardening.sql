-- Public waitlist hardening.
-- Anonymous visitors call the function below; they never receive INSERT on
-- the table itself. The advisory lock makes the counters consistent when a
-- burst arrives at the same time.
create or replace function public.universe_join_waitlist(
 p_email text,
 p_locale text default 'es',
 p_source text default 'landing'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 normalized text := lower(btrim(coalesce(p_email, '')));
 recent_count integer;
 today_count integer;
begin
 if normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(normalized) < 6
    or length(normalized) > 254 then
   raise exception 'WAITLIST_INVALID_EMAIL' using errcode = '22023';
 end if;

 if p_locale not in ('es', 'va') then
   raise exception 'WAITLIST_INVALID_LOCALE' using errcode = '22023';
 end if;

 if p_source not in ('landing', 'roadmap', 'blog') then
   raise exception 'WAITLIST_INVALID_SOURCE' using errcode = '22023';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('entreclases-waitlist', 0));

 -- Keep duplicate requests indistinguishable from new requests.
 if exists (
   select 1 from public.universe_waitlist
   where email = normalized
 ) then
   return jsonb_build_object('status', 'saved');
 end if;

 select count(*)::integer into recent_count
 from public.universe_waitlist
 where created_at >= now() - interval '1 minute';

 if recent_count >= 60 then
   raise exception 'WAITLIST_RATE_LIMIT' using errcode = 'P0001';
 end if;

 select count(*)::integer into today_count
 from public.universe_waitlist
 where created_at >= date_trunc('day', now());

 if today_count >= 1000 then
   raise exception 'WAITLIST_RATE_LIMIT' using errcode = 'P0001';
 end if;

 insert into public.universe_waitlist(email, locale, source)
 values (normalized, p_locale, p_source);

 return jsonb_build_object('status', 'saved');
end;
$$;

drop policy if exists universe_waitlist_join on public.universe_waitlist;
revoke insert on public.universe_waitlist from public, anon, authenticated;
revoke all on function public.universe_join_waitlist(text, text, text) from public, anon, authenticated;
grant execute on function public.universe_join_waitlist(text, text, text) to anon, authenticated;
